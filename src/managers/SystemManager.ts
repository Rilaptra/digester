// src/managers/SystemManager.ts
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Static class for system health checks and updates> */

import { join } from "node:path";
import Boxen from "boxen";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { padEndVisual } from "../utils/formatting.js"; // Import helper baru
import { generateLog } from "../utils/logger.js";

// --- TYPES ---
interface SystemMeta {
  lastUpdateCheck: number; // Timestamp
}

interface PackageCheck {
  name: string;
  current: string;
  latest: string;
  type: "runtime" | "cli" | "dependency" | "dev-dependency";
  severity: "info" | "warn" | "critical";
}

// --- CONSTANTS ---
const META_FILE = join(SYSTEM.BIN_DIR, "system.meta.json");
const CHECK_INTERVAL = 1000 * 60 * 60 * 12; // 12 Jam (Biar ga spam request)
const TIMEOUT_MS = 2500; // 2.5 Detik timeout

/**
 * 🛡️ SYSTEM MANAGER
 * Handles system-level operations including health checks, update audits, and environment integrity.
 * Manages update notifications for the CLI, Bun runtime, and project dependencies.
 */
export class SystemManager {
  /**
   * Internal promise representing the background audit process.
   * @private
   */
  private static auditPromise: Promise<PackageCheck[]> | null = null;

  /**
   * Cached system metadata including last update check timestamp.
   * @private
   */
  private static meta: SystemMeta = { lastUpdateCheck: 0 };

  /**
   * Initializes the SystemManager.
   * Loads metadata and starts a background update audit if the cache interval has passed.
   * This is a fire-and-forget operation typically called at application startup.
   */
  static async init() {
    await SystemManager.loadMeta();

    // Smart Cache Check:
    // Kalau belum 12 jam dari cek terakhir, SKIP audit biar kenceng!
    const now = Date.now();
    if (now - SystemManager.meta.lastUpdateCheck < CHECK_INTERVAL) {
      // Kecuali user maksa pake flag --force-check (optional logic, kita skip dulu biar simple)
      return;
    }

    // Start Audit di Background
    SystemManager.auditPromise = SystemManager.performAudit();

    // Update timestamp biar next run ga ngecek lagi
    SystemManager.meta.lastUpdateCheck = now;
    SystemManager.saveMeta(); // Gak perlu await, biarin async I/O
  }

  // --- 💾 PERSISTENCE LAYER ---

  /**
   * Loads system metadata from the persistence file.
   * Resets to default if the file is missing or corrupt.
   * @private
   */
  private static async loadMeta() {
    try {
      const file = Bun.file(META_FILE);
      if (await file.exists()) {
        SystemManager.meta = await file.json();
      }
    } catch {
      // Corrupt file? Reset aja. Self-healing code.
      SystemManager.meta = { lastUpdateCheck: 0 };
    }
  }

  /**
   * Saves system metadata to the persistence file.
   * Ensures the bin directory exists before writing.
   * @private
   */
  private static async saveMeta() {
    try {
      // Pastikan directory bin ada
      const { mkdir } = await import("node:fs/promises");
      await mkdir(SYSTEM.BIN_DIR, { recursive: true });
      await Bun.write(META_FILE, JSON.stringify(SystemManager.meta));
    } catch {
      // Silent fail is okay for cache
    }
  }

  // --- 🕵️ AUDIT LOGIC ---

  /**
   * Performs a comprehensive update audit.
   * Checks for updates for Digester CLI, Bun runtime, and project dependencies.
   * @private
   * @returns A promise that resolves to an array of available package updates.
   */
  private static async performAudit(): Promise<PackageCheck[]> {
    const checks: Promise<PackageCheck | null>[] = [];

    // 1. Cek Digester (Self) - CRITICAL
    checks.push(
      SystemManager.checkPackage("@rilaptra/digester", SYSTEM.VERSION, "cli"),
    );

    // 2. Cek Bun Runtime - WARN
    checks.push(SystemManager.checkPackage("bun", Bun.version, "runtime"));

    // 3. Cek Project Dependencies - INFO
    const projectChecks = await SystemManager.prepareProjectDeps();
    checks.push(...projectChecks);

    const results = await Promise.all(checks);

    return results.filter(
      (r): r is PackageCheck =>
        r !== null &&
        r.current !== r.latest &&
        SystemManager.isNewer(r.latest, r.current),
    );
  }

  /**
   * Prepares update check requests for all project dependencies found in package.json.
   * @private
   * @returns A promise that resolves to an array of package check promises.
   */
  private static async prepareProjectDeps(): Promise<
    Promise<PackageCheck | null>[]
  > {
    try {
      // Cek di Current Working Directory user
      const pkgPath = join(process.cwd(), "package.json");
      const file = Bun.file(pkgPath);

      if (!(await file.exists())) return [];

      const pkg = await file.json();
      const requests: Promise<PackageCheck | null>[] = [];

      const addDeps = (
        deps: Record<string, string>,
        type: "dependency" | "dev-dependency",
      ) => {
        if (!deps) return;
        Object.entries(deps).forEach(([name, version]) => {
          const cleanVer = version.replace(/^[\^~]/, "");
          if (!/^\d/.test(cleanVer)) return; // Skip path/git deps
          requests.push(SystemManager.checkPackage(name, cleanVer, type));
        });
      };

      addDeps(pkg.dependencies, "dependency");
      addDeps(pkg.devDependencies, "dev-dependency");
      return requests;
    } catch {
      return [];
    }
  }

  /**
   * Checks the latest version of a package from the npm registry.
   * @private
   * @param name - The name of the package to check.
   * @param currentVer - The current version of the package.
   * @param type - The type of package (runtime, cli, dependency, or dev-dependency).
   * @returns A promise that resolves to a PackageCheck object or null if failed.
   */
  private static async checkPackage(
    name: string,
    currentVer: string,
    type: PackageCheck["type"],
  ): Promise<PackageCheck | null> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(`https://registry.npmjs.org/${name}/latest`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(id);

      if (!res.ok) return null;

      const data = (await res.json()) as { version: string };

      let severity: PackageCheck["severity"] = "info";
      if (type === "cli") severity = "critical";
      if (type === "runtime") severity = "warn";

      return {
        name,
        current: currentVer,
        latest: data.version,
        type,
        severity,
      };
    } catch {
      return null; // Offline or Timeout -> Ignore
    }
  }

  // --- 📢 NOTIFICATION LAYER ---

  /**
   * Notifies the user of any available updates.
   * This method is designed to be non-blocking with a short timeout.
   * Typically called at the end of the application lifecycle.
   */
  static async notify() {
    if (!SystemManager.auditPromise) return; // Kalau gak ada proses audit (karena cache), skip.

    try {
      // Race: Audit Result vs Timeout pendek
      const updates = await Promise.race([
        SystemManager.auditPromise,
        new Promise<PackageCheck[]>((r) => setTimeout(() => r([]), 800)),
      ]);

      if (!updates || updates.length === 0) return;

      SystemManager.renderReport(updates);
    } catch {
      // Safety net
    }
  }

  // ... (di dalam class SystemManager) ...

  private static renderReport(updates: PackageCheck[]) {
    generateLog({ type: "info", raw: true }, "");
    const cli = updates.find((u) => u.type === "cli");
    const runtime = updates.find((u) => u.type === "runtime");
    const deps = updates
      .filter((u) => u.type.includes("dependency"))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (cli) {
      generateLog(
        { type: "info", raw: true },
        Boxen(
          chalk.white(`New version available: `) +
            chalk.dim(cli.current) +
            chalk.reset(" ➜ ") +
            chalk.green.bold(cli.latest) +
            "\n" +
            chalk.cyan("Run: ") +
            chalk.white.bold("digest update") +
            chalk.cyan(" or ") +
            chalk.white.bold("bun i -g @rilaptra/digester"),
          {
            padding: 1,
            margin: 0,
            borderStyle: "round",
            borderColor: "green",
            title: "🚀 Digester Update",
            titleAlignment: "center",
          },
        ),
      );
      generateLog({ type: "info", raw: true }, "");
    }

    if (runtime) {
      generateLog(
        { type: "warn", raw: true },
        chalk.bgYellow.black.bold(" BUN UPDATE ") +
          chalk.yellow(` v${runtime.current} ➜ v${runtime.latest} `) +
          chalk.dim(`[${process.platform}-${process.arch}]`),
      );
      generateLog(
        { type: "info", raw: true },
        chalk.dim("   Run 'bun upgrade' to optimize performance.\n"),
      );
    }

    if (deps.length > 0) {
      // 🔥 NATIVE BUN TABLE RENDERER
      const headers = ["Package", "Type", "Current", "Latest"];
      const colWidths = [25, 10, 15, 15];

      const drawLine = (
        cols: string[],
        chars: { l: string; m: string; r: string; c: string },
      ) => {
        return (
          chars.l +
          cols
            .map((c, i) => padEndVisual(c, colWidths[i], chars.c))
            .join(chars.m) +
          chars.r
        );
      };

      const topBorder = drawLine(
        colWidths.map((w) => "─".repeat(w)),
        { l: "┌", m: "┬", r: "┐", c: "─" },
      );
      const headerRow = drawLine(
        headers.map((h) => chalk.bold.cyan(h)),
        { l: "│", m: "│", r: "│", c: " " },
      );
      const midBorder = drawLine(
        colWidths.map((w) => "─".repeat(w)),
        { l: "├", m: "┼", r: "┤", c: "─" },
      );
      const botBorder = drawLine(
        colWidths.map((w) => "─".repeat(w)),
        { l: "└", m: "┴", r: "┘", c: "─" },
      );

      generateLog(
        { type: "info", raw: true },
        chalk.bold.white(`📦 Project Dependencies (${deps.length} outdated):`),
      );
      generateLog({ type: "info", raw: true }, topBorder);
      generateLog({ type: "info", raw: true }, headerRow);
      generateLog({ type: "info", raw: true }, midBorder);

      const limit = 5;
      deps.slice(0, limit).forEach((u) => {
        const row = [
          chalk.white(u.name),
          u.type === "dependency" ? chalk.green("prod") : chalk.dim("dev"),
          chalk.red(u.current),
          chalk.green.bold(u.latest),
        ];
        generateLog(
          { type: "info", raw: true },
          drawLine(row, { l: "│", m: "│", r: "│", c: " " }),
        );
      });

      generateLog({ type: "info", raw: true }, botBorder);

      if (deps.length > limit) {
        generateLog(
          { type: "info", raw: true },
          chalk.dim(`   ... and ${deps.length - limit} more.`),
        );
      }
      generateLog(
        { type: "info", raw: true },
        chalk.dim("   Run 'bun update' to fix.\n"),
      );
    }
  }

  /**
   * Compares two semver strings to determine if the latest version is newer.
   * @private
   * @param latest - The latest version string.
   * @param current - The current version string.
   * @returns True if the latest version is newer than the current version.
   */
  private static isNewer(latest: string, current: string): boolean {
    // Remove non-numeric (e.g. "v1.2.0" -> "1.2.0")
    const c = current
      .replace(/^[^\d]+/, "")
      .split(".")
      .map(Number);
    const l = latest
      .replace(/^[^\d]+/, "")
      .split(".")
      .map(Number);
    for (let i = 0; i < 3; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }
}

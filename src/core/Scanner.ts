import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import type { AppConfig, ScanStats } from "../types/index.js";

export class Scanner {
  /**
   * Normalize config biar backward-compatible.
   * Kalau config lama belum punya forceInclude, tambah default.
   */
  private static normalizeConfig(config: Partial<AppConfig>): AppConfig {
    return {
      ignoredPatterns: config.ignoredPatterns || new Set(),
      ignoredExts: config.ignoredExts || new Set(),
      maxFileSize: config.maxFileSize || 500,
      forceInclude: config.forceInclude || new Set(), // ← FIX crash
      prePushScripts: config.prePushScripts || [],
    };
  }

  // ─── FORCE INCLUDE LOGIC ───

  private static isForceIncluded(
    fullPath: string,
    rootDir: string,
    forceInclude: Set<string>,
  ): boolean {
    if (!forceInclude || forceInclude.size === 0) return false; // ← defensive

    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");

    for (const pattern of forceInclude) {
      const normalized = pattern.replace(/\\/g, "/");
      if (relPath === normalized) return true;
      if (relPath.startsWith(`${normalized}/`)) return true;
      if (normalized.startsWith(`${relPath}/`)) return true;
    }

    return false;
  }

  // ─── IGNORED PATTERNS CHECK ───

  /**
   * Cek apakah path match ignoredPatterns.
   * Support BAIK basename ("dist") MAUPUN relative path ("src/commands").
   *
   * 🔥 INI YANG SEBELUMNYA BUG:
   *    Hanya cek basename → "src/commands" gak pernah match
   */
  private static isIgnoredPath(
    fullPath: string,
    rootDir: string,
    ignoredPatterns: Set<string>,
  ): boolean {
    if (!ignoredPatterns || ignoredPatterns.size === 0) return false;

    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
    const dirName = basename(fullPath);

    for (const pattern of ignoredPatterns) {
      const p = pattern.replace(/\\/g, "/");

      // Match 1: Exact basename (e.g., pattern="dist", path="/project/dist")
      if (dirName === p) return true;

      // Match 2: Exact relative path (e.g., pattern="src/commands", relPath="src/commands")
      if (relPath === p) return true;

      // Match 3: Path is INSIDE an ignored directory
      //   pattern="src/commands", relPath="src/commands/ansi.ts"
      //   pattern="assets", relPath="assets/configs/db.json"
      if (relPath.startsWith(`${p}/`)) return true;

      // Match 4: Path contains pattern as a segment
      //   pattern="node_modules", relPath="packages/app/node_modules"
      if (relPath.includes(`/${p}/`)) return true;
    }

    return false;
  }

  /**
   * Cek apakah directory harus di-recurse.
   *
   * 🔥 FIX: Juga cek relative path, bukan cuma basename.
   * Jadi "src/commands" di ignoredPatterns → folder commands di dalam src gak di-recurse.
   */
  private static shouldRecurseDir(
    dirPath: string,
    rootDir: string,
    config: AppConfig,
  ): boolean {
    // Kalau force-include → selalu recurse
    if (Scanner.isForceIncluded(dirPath, rootDir, config.forceInclude)) {
      return true;
    }

    // Cek apakah dir ini di-ignore
    if (Scanner.isIgnoredPath(dirPath, rootDir, config.ignoredPatterns)) {
      // TAPI: kalau ada forceInclude child → tetap recurse
      const relPath = relative(rootDir, dirPath).replace(/\\/g, "/");
      for (const pattern of config.forceInclude) {
        const normalized = pattern.replace(/\\/g, "/");
        if (normalized.startsWith(`${relPath}/`) || normalized === relPath) {
          return true;
        }
      }
      return false;
    }

    return true;
  }

  /**
   * Cek apakah file harus di-include.
   */
  private static shouldIncludeFile(
    filePath: string,
    rootDir: string,
    config: AppConfig,
  ): { include: boolean; reason: string } {
    const ext = extname(filePath);

    // ✅ PRIORITY 1: forceInclude override semua
    if (Scanner.isForceIncluded(filePath, rootDir, config.forceInclude)) {
      return { include: true, reason: "force-include" };
    }

    // ❌ Check ignoredPatterns (basename + relative path)
    if (Scanner.isIgnoredPath(filePath, rootDir, config.ignoredPatterns)) {
      return { include: false, reason: "ignored-pattern" };
    }

    // ❌ Check ignoredExts
    if (config.ignoredExts?.has(ext)) {
      return { include: false, reason: "ignored-ext" };
    }

    return { include: true, reason: "default" };
  }

  // ─── MAIN SCAN ───

  static async run(
    rootDir: string,
    rawConfig: Partial<AppConfig>,
  ): Promise<ScanStats> {
    const config = Scanner.normalizeConfig(rawConfig);
    const start = performance.now();

    const files: ScanStats["files"] = [];
    const tree: string[] = [];
    let totalSize = 0;
    let skippedCount = 0;
    let skippedSize = 0;
    let forceIncludedCount = 0;
    const extStats: Record<string, { count: number; size: number }> = {};

    const walk = async (dir: string, prefix: string) => {
      let entries: Array<{ name: string; isDirectory(): boolean }> = [];

      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      // Sort biar tree konsisten dan enak dibaca
      entries.sort((a, b) => a.name.localeCompare(b.name));

      const visible: Array<{
        name: string;
        isDirectory: boolean;
        fullPath: string;
      }> = [];

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          if (Scanner.shouldRecurseDir(fullPath, rootDir, config)) {
            visible.push({
              name: entry.name,
              isDirectory: true,
              fullPath,
            });
          }
          continue;
        }

        const { include, reason } = Scanner.shouldIncludeFile(
          fullPath,
          rootDir,
          config,
        );

        if (!include) {
          skippedCount++;
          continue;
        }

        let fileInfo: { size: number } | undefined;

        try {
          fileInfo = await stat(fullPath);
        } catch {
          skippedCount++;
          continue;
        }

        if (!fileInfo) {
          skippedCount++;
          continue;
        }

        const sizeKB = fileInfo.size / 1024;

        if (reason !== "force-include" && sizeKB > config.maxFileSize) {
          skippedCount++;
          skippedSize += fileInfo.size;
          continue;
        }

        const ext = extname(entry.name);

        files.push({
          path: fullPath,
          relPath: relative(rootDir, fullPath),
          size: fileInfo.size,
          ext,
        });

        totalSize += fileInfo.size;

        if (!extStats[ext]) {
          extStats[ext] = { count: 0, size: 0 };
        }

        extStats[ext].count++;
        extStats[ext].size += fileInfo.size;

        if (reason === "force-include") {
          forceIncludedCount++;
        }

        visible.push({
          name: entry.name,
          isDirectory: false,
          fullPath,
        });
      }

      for (let i = 0; i < visible.length; i++) {
        const item = visible[i];
        const isLast = i === visible.length - 1;

        const connector = isLast ? "└── " : "├── ";
        const childPrefix = prefix + (isLast ? "    " : "│   ");

        if (item.isDirectory) {
          tree.push(`${prefix}${connector}${item.name}/`);
          await walk(item.fullPath, childPrefix);
        } else {
          tree.push(`${prefix}${connector}${item.name}`);
        }
      }
    };

    await walk(rootDir, "");

    const duration = (performance.now() - start).toFixed(0);

    return {
      files,
      tree,
      skippedCount,
      skippedSize,
      totalSize,
      forceIncludedCount,
      extStats,
      duration: `${duration}ms`,
    };
  }
}

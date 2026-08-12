/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Static class> */

import { join } from "node:path";
import { Glob } from "bun";
import { DEFAULT_CONFIG, SYSTEM } from "../constants/defaults.js";
import type { AppConfig, AuthConfig } from "../types/index.js";

/**
 * Manages application and authentication configuration.
 * Handles loading configuration from files and environment.
 */
export class ConfigManager {
  static async load(targetDir: string): Promise<AppConfig> {
    const cfgPath = join(targetDir, "prompter.config.json");

    // Helper buat return fresh copy dari defaults
    const getDefault = (): AppConfig => ({
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSize,
      forceInclude: new Set(DEFAULT_CONFIG.forceInclude),
      prePushScripts: [...(DEFAULT_CONFIG.prePushScripts || [])],
    });

    const finalConfig = getDefault();

    // 1. Load prompter.config.json (Smart Override)
    if (await Bun.file(cfgPath).exists()) {
      try {
        const raw = await Bun.file(cfgPath).json();

        // 🔥 OVERRIDE: Timpa default HANYA jika key-nya didefine di file JSON
        if (raw.ignoredPatterns)
          finalConfig.ignoredPatterns = new Set(raw.ignoredPatterns);
        if (raw.ignoredExts) finalConfig.ignoredExts = new Set(raw.ignoredExts);
        if (raw.maxFileSize) finalConfig.maxFileSize = raw.maxFileSize;
        if (raw.forceInclude)
          finalConfig.forceInclude = new Set(raw.forceInclude);
        if (raw.prePushScripts) finalConfig.prePushScripts = raw.prePushScripts;
      } catch {
        // Abaikan jika JSON corrupt, pakai default
      }
    }

    // 2. Append isi .gitignore biar tetep aman
    try {
      const gitPath = join(targetDir, ".gitignore");
      if (await Bun.file(gitPath).exists()) {
        const txt = await Bun.file(gitPath).text();
        txt.split("\n").forEach((line) => {
          const l = line.trim();
          if (l && !l.startsWith("#")) {
            finalConfig.ignoredPatterns.add(l.replace(/^\/|\/$/g, ""));
          }
        });
      }
    } catch {}

    return finalConfig;
  }

  // --- AUTH CONFIG (Global) ---
  /**
   * Retrieves the global authentication configuration.
   *
   * @returns A promise that resolves to the authentication configuration.
   */
  static async getAuth(): Promise<AuthConfig> {
    const file = Bun.file(SYSTEM.AUTH_FILE);
    if (await file.exists()) {
      try {
        return await file.json();
      } catch {
        return {};
      }
    }
    return {};
  }

  /**
   * Saves or updates the global authentication configuration.
   *
   * @param cfg - The partial authentication configuration to save.
   */
  static async saveAuth(cfg: AuthConfig) {
    const current = await ConfigManager.getAuth();
    const final = { ...current, ...cfg };
    await Bun.write(SYSTEM.AUTH_FILE, JSON.stringify(final, null, 2));
  }

  /**
   * Retrieves available scripts from package.json in the target directory.
   *
   * @param targetDir - The directory containing package.json.
   * @returns A promise that resolves to an array of script names.
   */
  static async getAvailableScripts(targetDir: string): Promise<string[]> {
    const pkgPath = join(targetDir, "package.json");
    if (await Bun.file(pkgPath).exists()) {
      try {
        const pkg = await Bun.file(pkgPath).json();
        return pkg.scripts ? Object.keys(pkg.scripts) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  /**
   * Lists TypeScript files in predefined directories of the target project.
   *
   * @param targetDir - The root directory to scan.
   * @returns A promise that resolves to an array of relative paths to .ts files.
   * 🔥 NATIVE BUN GLOB: Scan file .ts dengan super cepat
   */
  static async listTSFiles(targetDir: string): Promise<string[]> {
    const results: string[] = [];
    const dirsToScan = [".", "scripts", "tools", "bin"];

    // Pattern: Cari semua file .ts di dalam folder target, max depth 2
    const glob = new Glob("**/*.ts");

    for (const d of dirsToScan) {
      const dirPath = join(targetDir, d);
      try {
        // Scan sync pakai native Bun Glob
        for (const file of glob.scanSync({
          cwd: dirPath,
          onlyFiles: true,
          dot: false,
        })) {
          results.push(join(d, file).replace(/\\/g, "/"));
        }
      } catch {
        // Ignore missing directories
      }
    }
    return results;
  }
}

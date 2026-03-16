/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Static class> */
import { join } from "node:path";
import { readdir } from "node:fs/promises";
import chalk from "chalk";
import { DEFAULT_CONFIG, SYSTEM } from "../constants/defaults.js";
import type { AppConfig, AuthConfig } from "../types/index.js";
import { generateLog } from "../utils/logger.js";

/**
 * Manages application and authentication configuration.
 * Handles loading configuration from files and environment.
 */
export class ConfigManager {
  /**
   * Loads application configuration from the target directory.
   * Merges defaults with prompter.config.json and .gitignore.
   *
   * @param targetDir - The root directory of the project to load config for.
   * @returns A promise that resolves to the combined application configuration.
   */
  static async load(targetDir: string): Promise<AppConfig> {
    const final: AppConfig = {
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSizeKB * 1024,
      prePushScripts: [...DEFAULT_CONFIG.prePushScripts],
    };

    // 1. Load prompter.config.json
    const targetCfgPath = join(targetDir, "prompter.config.json");
    const cfgFile = Bun.file(targetCfgPath);
    if (await cfgFile.exists()) {
      try {
        const user = await cfgFile.json();
        const patterns = user.ignorePatterns || user.ignoredPatterns;
        if (Array.isArray(patterns)) {
          for (const x of patterns) final.ignoredPatterns.add(x);
        }

        const exts = user.ignoreExtensions || user.ignoredExts || user.ignoreExts;
        if (Array.isArray(exts)) {
          for (const x of exts) final.ignoredExts.add(x);
        }

        const maxKB = user.defaultLimitKB || user.maxFileSizeKB;
        if (maxKB) final.maxFileSize = maxKB * 1024;

        if (Array.isArray(user.prePushScripts)) {
          final.prePushScripts = user.prePushScripts;
        }
      } catch {
        generateLog(
          { type: "warn" },
          chalk.yellow("  ⚠️  Config error (JSON Invalid), using defaults."),
        );
      }
    }

    // 2. Load .gitignore
    const gitPath = join(targetDir, ".gitignore");
    const gitFile = Bun.file(gitPath);
    if (await gitFile.exists()) {
      try {
        const txt = await gitFile.text();
        const lines = txt.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i].trim();
          if (l && !l.startsWith("#")) {
            final.ignoredPatterns.add(l.replace(/^\/|\/$/g, ""));
          }
        }
      } catch {}
    }

    return final;
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
   * Optimized for Bun.
   *
   * @param targetDir - The root directory to scan.
   * @returns A promise that resolves to an array of relative paths to .ts files.
   */
  static async listTSFiles(targetDir: string): Promise<string[]> {
    const results: string[] = [];
    const dirsToScan = [".", "scripts", "tools", "bin"];

    for (const d of dirsToScan) {
      const dirPath = join(targetDir, d);
      try {
        const files = await readdir(dirPath);
        for (const f of files) {
          if (f.endsWith(".ts")) {
            results.push(join(d, f).replace(/\\/g, "/"));
          }
        }
      } catch {}
    }
    return results;
  }
}

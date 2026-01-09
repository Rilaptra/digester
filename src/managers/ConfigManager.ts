/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: ConfigManager is a static class> */
import { join } from "node:path";
import chalk from "chalk";
import { DEFAULT_CONFIG, SYSTEM } from "../constants/defaults.js";
import type { AppConfig, AuthConfig } from "../types/index.js";
import { generateLog } from "../utils/logger.js";

export class ConfigManager {
  static async load(targetDir: string): Promise<AppConfig> {
    const final: AppConfig = {
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSizeKB * 1024,
    };

    // 1. Load prompter.config.json
    const targetCfgPath = join(targetDir, "prompter.config.json");
    const cfgFile = Bun.file(targetCfgPath);
    if (await cfgFile.exists()) {
      try {
        const user = await cfgFile.json();
        const patterns = user.ignorePatterns || user.ignoredPatterns;
        if (Array.isArray(patterns)) {
          patterns.forEach((x: string) => {
            final.ignoredPatterns.add(x);
          });
        }

        const exts =
          user.ignoreExtensions || user.ignoredExts || user.ignoreExts;
        if (Array.isArray(exts)) {
          exts.forEach((x: string) => {
            final.ignoredExts.add(x);
          });
        }

        const maxKB = user.defaultLimitKB || user.maxFileSizeKB;
        if (maxKB) final.maxFileSize = maxKB * 1024;
      } catch (_e) {
        generateLog(
          { type: "warn" },
          chalk.yellow("   ⚠️  Config error (JSON Invalid), using defaults."),
        );
      }
    }

    // 2. Load .gitignore
    try {
      const gitPath = join(targetDir, ".gitignore");
      const gitFile = Bun.file(gitPath);
      if (await gitFile.exists()) {
        const txt = await gitFile.text();
        txt.split("\n").forEach((line) => {
          const l = line.trim();
          if (l && !l.startsWith("#"))
            final.ignoredPatterns.add(l.replace(/^\/|\/$/g, ""));
        });
      }
    } catch {}

    return final;
  }

  // --- AUTH CONFIG (Global) ---
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

  static async saveAuth(cfg: AuthConfig) {
    const current = await ConfigManager.getAuth();
    const final = { ...current, ...cfg };
    await Bun.write(SYSTEM.AUTH_FILE, JSON.stringify(final, null, 2));
  }
}

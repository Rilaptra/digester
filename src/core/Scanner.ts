import { readdir, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { ConfigManager } from "../managers/ConfigManager.js"; // ← TAMBAH INI
import type { AppConfig, ScanStats, TreeIgnoreMode } from "../types/index.js"; // ← Update type import

export class Scanner {
  private static normalizeConfig(config: Partial<AppConfig>): AppConfig {
    return {
      ignoredPatterns: config.ignoredPatterns || new Set(),
      ignoredExts: config.ignoredExts || new Set(),
      maxFileSize: config.maxFileSize || 500,
      forceInclude: config.forceInclude || new Set(),
      prePushScripts: config.prePushScripts || [],
    };
  }

  private static isForceIncluded(
    fullPath: string,
    rootDir: string,
    forceInclude: Set<string>,
  ): boolean {
    if (!forceInclude || forceInclude.size === 0) return false;
    const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");
    for (const pattern of forceInclude) {
      const normalized = pattern.replace(/\\/g, "/");
      if (
        relPath === normalized ||
        relPath.startsWith(`${normalized}/`) ||
        normalized.startsWith(`${relPath}/`)
      )
        return true;
    }
    return false;
  }

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
      if (
        dirName === p ||
        relPath === p ||
        relPath.startsWith(`${p}/`) ||
        relPath.includes(`/${p}/`)
      )
        return true;
    }
    return false;
  }

  private static shouldRecurseDir(
    dirPath: string,
    rootDir: string,
    config: AppConfig,
  ): boolean {
    if (Scanner.isForceIncluded(dirPath, rootDir, config.forceInclude))
      return true;
    if (Scanner.isIgnoredPath(dirPath, rootDir, config.ignoredPatterns)) {
      const relPath = relative(rootDir, dirPath).replace(/\\/g, "/");
      for (const pattern of config.forceInclude) {
        const normalized = pattern.replace(/\\/g, "/");
        if (normalized.startsWith(`${relPath}/`) || normalized === relPath)
          return true;
      }
      return false;
    }
    return true;
  }

  private static shouldIncludeFile(
    filePath: string,
    rootDir: string,
    config: AppConfig,
  ): { include: boolean; reason: string } {
    const ext = extname(filePath);
    if (Scanner.isForceIncluded(filePath, rootDir, config.forceInclude))
      return { include: true, reason: "force-include" };
    if (Scanner.isIgnoredPath(filePath, rootDir, config.ignoredPatterns))
      return { include: false, reason: "ignored-pattern" };
    if (config.ignoredExts?.has(ext))
      return { include: false, reason: "ignored-ext" };
    return { include: true, reason: "default" };
  }

  /**
   * 🤖 AI COPILOT HELPER: Generate clean relative paths untuk AI
   */
  static async getCleanTree(
    rootDir: string,
    mode: TreeIgnoreMode,
  ): Promise<string[]> {
    let config: Partial<AppConfig> = {
      ignoredPatterns: new Set(),
      ignoredExts: new Set(),
      maxFileSize: 500,
      forceInclude: new Set(),
    };

    try {
      if (mode === "gitignore") {
        const gitignorePath = join(rootDir, ".gitignore");
        if (await Bun.file(gitignorePath).exists()) {
          const text = await Bun.file(gitignorePath).text();
          const patterns = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith("#") && !l.startsWith("!"))
            .map((l) => l.replace(/^\/|\/$/g, ""));
          config.ignoredPatterns = new Set(patterns);
        }
      } else if (mode === "config") {
        const cfgPath = join(rootDir, "prompter.config.json");
        if (await Bun.file(cfgPath).exists()) {
          const raw = await Bun.file(cfgPath).json();
          if (raw.ignoredPatterns)
            config.ignoredPatterns = new Set(raw.ignoredPatterns);
          if (raw.ignoredExts) config.ignoredExts = new Set(raw.ignoredExts);
        }
      } else if (mode === "both") {
        config = await ConfigManager.load(rootDir);
      }

      const stats = await Scanner.run(rootDir, config);

      // 🔥 FIX UTAMA: Kembalikan array of relative paths murni (tanpa icon/ANSI)
      // Contoh: "src/app/api/ghost/route.ts"
      return stats.files.map((f) => f.relPath.replace(/\\/g, "/"));
    } catch (error) {
      throw new Error(
        `Scanner.getCleanTree failed: ${(error as Error).message}`,
      );
    }
  }

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

    // 🔥 REWRITE: Walk function dengan prefix tree yang benar
    const walk = async (dir: string, prefix: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      // Sort biar konsisten
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
            visible.push({ name: entry.name, isDirectory: true, fullPath });
          }
        } else {
          const { include, reason } = Scanner.shouldIncludeFile(
            fullPath,
            rootDir,
            config,
          );
          if (!include) {
            skippedCount++;
            continue;
          }

          let fileInfo;
          try {
            fileInfo = await stat(fullPath);
          } catch {
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
          if (!extStats[ext]) extStats[ext] = { count: 0, size: 0 };
          extStats[ext].count++;
          extStats[ext].size += fileInfo.size;
          if (reason === "force-include") forceIncludedCount++;

          visible.push({ name: entry.name, isDirectory: false, fullPath });
        }
      }

      // 🔥 RENDER TREE DENGAN BENAR (├── dan └──)
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

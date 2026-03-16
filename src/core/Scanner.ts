/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Scanner is a static class> */
import { extname, join, relative } from "node:path";
import { readdir } from "node:fs/promises";
import type { AppConfig, ScanStats } from "../types/index.js";

/**
 * High-performance file scanner optimized for Bun.
 * Uses native Bun APIs for faster I/O and minimal memory overhead.
 */
export class Scanner {
  /**
   * Starts a recursive scan of the specified directory.
   */
  static async run(dir: string, cfg: AppConfig): Promise<ScanStats> {
    const start = performance.now();
    const stats: ScanStats = {
      files: [],
      tree: [],
      skippedCount: 0,
      skippedSize: 0,
      totalSize: 0,
      extStats: {},
      duration: "",
    };

    await this.walk(dir, dir, cfg, stats, "");

    stats.duration = (performance.now() - start).toFixed(0);
    return stats;
  }

  /**
   * Recursive walker using Bun.readdir for high-performance directory traversal.
   */
  private static async walk(
    base: string,
    current: string,
    cfg: AppConfig,
    stats: ScanStats,
    prefix: string,
  ) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    // Filter and sort entries efficiently
    const valid = entries
      .filter((e) => {
        if (e.name.startsWith(".") && e.name !== ".gitignore" && e.name !== ".env.example") return false;
        if (cfg.ignoredPatterns.has(e.name)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      });

    const len = valid.length;
    for (let i = 0; i < len; i++) {
      const e = valid[i];
      const isLast = i === len - 1;
      const path = join(current, e.name);

      // Manage Tree Visualization (Max 800 nodes for performance)
      if (stats.tree.length < 800) {
        stats.tree.push(`${prefix}${isLast ? "└── " : "├── "}${e.name}${e.isDirectory() ? "/" : ""}`);
      } else if (stats.tree.length === 800) {
        stats.tree.push(`${prefix}   ... (truncated)`);
      }

      if (e.isDirectory()) {
        await this.walk(base, path, cfg, stats, prefix + (isLast ? "    " : "│   "));
      } else {
        const ext = extname(e.name).toLowerCase();

        // Fast path for ignored extensions/patterns
        if (cfg.ignoredExts.has(ext) || cfg.ignoredPatterns.has(e.name)) continue;

        try {
          // Use Bun.file for metadata instead of stat if possible,
          // but stat is still needed for size in this context.
          const file = Bun.file(path);
          const size = file.size;

          if (size > cfg.maxFileSize) {
            stats.skippedCount++;
            stats.skippedSize += size;
            continue;
          }

          stats.files.push({
            path,
            relPath: relative(base, path),
            size: size,
            ext: ext.slice(1) || "txt",
          });

          stats.totalSize += size;

          const extData = stats.extStats[ext] || (stats.extStats[ext] = { count: 0, size: 0 });
          extData.count++;
          extData.size += size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  }
}

/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Scanner is a static class> */
import type { Dirent } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import type { AppConfig, ScanStats } from "../types/index.js";

export class Scanner {
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
    await Scanner.walk(dir, dir, cfg, stats, "");
    stats.duration = (performance.now() - start).toFixed(0);
    return stats;
  }

  static async walk(
    base: string,
    current: string,
    cfg: AppConfig,
    stats: ScanStats,
    prefix: string,
  ) {
    let entries: Dirent[]; // 🟢 Fix 1: Explicit type definition
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    const valid = entries
      .filter((e) => {
        if (
          e.name.startsWith(".") &&
          e.name !== ".gitignore" &&
          e.name !== ".env.example"
        )
          return false;
        if (cfg.ignoredPatterns.has(e.name)) return false;
        return true;
      })
      .sort((a, b) => {
        // Optimization: logic simplified for readability & speed
        if (a.isDirectory() === b.isDirectory()) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory() ? -1 : 1;
      });

    // 🟢 Fix 2: Native for-loop (Memory efficient & solves TS2802)
    const len = valid.length;
    for (let i = 0; i < len; i++) {
      const e = valid[i];
      const isLast = i === len - 1;
      const path = join(current, e.name);

      // Tree Visualizer limit
      if (stats.tree.length < 800) {
        stats.tree.push(`${prefix}${isLast ? "└── " : "├── "}${e.name}`);
      } else if (stats.tree.length === 800) {
        stats.tree.push(`${prefix}   ... (truncated)`);
      }

      if (e.isDirectory()) {
        await Scanner.walk(
          base,
          path,
          cfg,
          stats,
          prefix + (isLast ? "    " : "│   "),
        );
      } else {
        const ext = extname(e.name).toLowerCase();

        // Quick check before async stat (Save I/O)
        if (cfg.ignoredExts.has(ext) || cfg.ignoredPatterns.has(e.name))
          continue;

        try {
          const s = await stat(path);
          if (s.size > cfg.maxFileSize) {
            stats.skippedCount++;
            stats.skippedSize += s.size;
            continue;
          }

          stats.files.push({
            path,
            relPath: relative(base, path),
            size: s.size,
            ext: ext.slice(1) || "txt",
          });

          stats.totalSize += s.size;

          // Initialize if not exists (shorthand check)
          if (!stats.extStats[ext]) stats.extStats[ext] = { count: 0, size: 0 };

          stats.extStats[ext].count++;
          stats.extStats[ext].size += s.size;
        } catch {
          // Silent fail for locked/missing files
        }
      }
    }
  }
}

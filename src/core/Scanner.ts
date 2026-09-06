import { readdir, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative } from "node:path";
import { ConfigManager } from "../managers/ConfigManager.js"; // ← TAMBAH INI
import type { AppConfig, ScanStats, TreeIgnoreMode } from "../types/index.js"; // ← Update type import

export class Scanner {
  /** Direktori yang SELALU disembunyikan dari AI tree, apapun modenya */
  private static readonly AI_TREE_HIDDEN_DIRS = new Set([
    ".git",
    "node_modules",
  ]);

  /** Ekstensi non-teks yang cuma makan slot 2000 (AI nggak bisa baca) */
  private static readonly AI_TREE_HIDDEN_EXTS = new Set([
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".ico",
    ".webp",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".zip",
    ".gz",
    ".tar",
    ".7z",
    ".mp4",
    ".mp3",
    ".wav",
    ".pdf",
    ".exe",
    ".dll",
    ".so",
    ".wasm",
    ".lock",
  ]);

  /**
   * 🤖 AI COPILOT HELPER: clean relative paths untuk AI (FIXED)
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

      // 🛡️ FIX: .git & node_modules JANGAN pernah bocor, apapun modenya.
      // Sebelumnya slice(0,2000) di AI dimakan .git/objects → AI buta ke src/
      config.ignoredPatterns = new Set([
        ...(config.ignoredPatterns ?? []),
        ...Scanner.AI_TREE_HIDDEN_DIRS,
      ]);
      config.ignoredExts = new Set([
        ...(config.ignoredExts ?? []),
        ...Scanner.AI_TREE_HIDDEN_EXTS,
      ]);

      const stats = await Scanner.run(rootDir, config);
      return stats.files.map((f) => f.relPath.replace(/\\/g, "/"));
    } catch (error) {
      throw new Error(
        `Scanner.getCleanTree failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * 🎯 DIGEST LANGSUNG dari daftar file eksplisit (AI + manual pick).
   * Nggak baca config, nggak apply ignore pattern — murni one-off.
   * Return ScanStats biar displayReport() & writeOutput() kepake ulang.
   */
  static async digestFiles(
    rootDir: string,
    relPaths: string[],
    opts: { maxFileSizeKB?: number } = {},
  ): Promise<ScanStats> {
    const start = performance.now();
    const maxFileSize = opts.maxFileSizeKB ?? 500;

    const files: ScanStats["files"] = [];
    const includedRels: string[] = [];
    const extStats: Record<string, { count: number; size: number }> = {};
    let totalSize = 0;
    let skippedCount = 0;
    let skippedSize = 0;

    const unique = [
      ...new Set(
        relPaths
          .map((p) => p.replace(/\\/g, "/").replace(/^\.\//, "").trim())
          .filter(Boolean),
      ),
    ];

    for (const rel of unique) {
      const fullPath = join(rootDir, rel);

      // ⛔ Anti path traversal: harus tetap di dalam rootDir
      const back = relative(rootDir, fullPath);
      if (back.startsWith("..") || isAbsolute(back)) {
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
      if (!fileInfo.isFile()) {
        skippedCount++;
        continue;
      }

      const sizeKB = fileInfo.size / 1024;
      if (sizeKB > maxFileSize) {
        skippedCount++;
        skippedSize += fileInfo.size;
        continue;
      }

      // 🛡️ Binary guard: null byte di 4KB pertama = bukan file teks
      try {
        const head = new Uint8Array(
          await Bun.file(fullPath).slice(0, 4096).arrayBuffer(),
        );
        if (head.includes(0)) {
          skippedCount++;
          skippedSize += fileInfo.size;
          continue;
        }
      } catch {
        skippedCount++;
        continue;
      }

      const ext = extname(rel);
      files.push({ path: fullPath, relPath: rel, size: fileInfo.size, ext });
      includedRels.push(rel);
      totalSize += fileInfo.size;
      if (!extStats[ext]) extStats[ext] = { count: 0, size: 0 };
      extStats[ext].count++;
      extStats[ext].size += fileInfo.size;
    }

    return {
      files,
      tree: Scanner.buildTreeFromPaths(includedRels),
      skippedCount,
      skippedSize,
      totalSize,
      forceIncludedCount: 0,
      extStats,
      duration: performance.now() - start,
    };
  }

  /** Tree mini cuma dari file yang kepilih */
  private static buildTreeFromPaths(relPaths: string[]): string[] {
    type Node = { dirs: Map<string, Node>; files: string[] };
    const root: Node = { dirs: new Map(), files: [] };

    for (const rel of relPaths) {
      const parts = rel.split("/");
      const fileName = parts.pop();
      if (!fileName) continue;
      let cur = root;
      for (const part of parts) {
        if (!cur.dirs.has(part))
          cur.dirs.set(part, { dirs: new Map(), files: [] });
        cur = cur.dirs.get(part)!;
      }
      cur.files.push(fileName);
    }

    const lines: string[] = [];
    const walkNode = (node: Node, prefix: string) => {
      const dirNames = [...node.dirs.keys()].sort();
      const fileNames = [...node.files].sort();
      const total = dirNames.length + fileNames.length;
      let i = 0;
      for (const d of dirNames) {
        const isLast = ++i === total;
        lines.push(`${prefix}${isLast ? "└── " : "├── "}${d}/`);
        walkNode(node.dirs.get(d)!, prefix + (isLast ? "    " : "│   "));
      }
      for (const f of fileNames) {
        const isLast = ++i === total;
        lines.push(`${prefix}${isLast ? "└── " : "├── "}${f}`);
      }
    };
    walkNode(root, "");
    return lines;
  }

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
    const duration = performance.now() - start;

    return {
      files,
      tree,
      skippedCount,
      skippedSize,
      totalSize,
      forceIncludedCount,
      extStats,
      duration,
    };
  }
}

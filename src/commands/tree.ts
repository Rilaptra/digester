import { readdir, stat } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type { AppConfig } from "../types/index.js";

export class TreeCommand extends BaseCommand {
  public name = "tree";
  public description =
    "Display project structure with smart folder icons and media support";
  public aliases = ["t"];

  // Mapping folder name ke icon khusus
  private readonly folderMap: Record<string, string> = {
    src: "📦",
    core: "🧠",
    utils: "🛠️",
    commands: "🐚",
    managers: "👔",
    types: "🏷️",
    test: "🧪",
    tests: "🧪",
    docs: "📚",
    scripts: "📜",
    assets: "🎨",
    public: "🌍",
    node_modules: "📦",
    git: "🌿",
  };

  // Mapping extension ke Icon dan Warna
  private readonly extMap: Record<
    string,
    { icon: string; color: (text: string) => string }
  > = {
    // --- Languages & Scripts ---
    ".ts": { icon: "🟦", color: chalk.rgb(49, 120, 198) }, // TypeScript Blue
    ".tsx": { icon: "⚛️ ", color: chalk.rgb(97, 218, 251) }, // React Cyan
    ".js": { icon: "🟨", color: chalk.rgb(247, 223, 30) }, // JS Yellow
    ".mjs": { icon: "🟨", color: chalk.rgb(255, 200, 60) }, // Lighter Gold
    ".cjs": { icon: "🟨", color: chalk.rgb(255, 160, 0) }, // Darker Gold
    ".jsx": { icon: "⚛️ ", color: chalk.rgb(255, 215, 0) }, // Gold/Yellowish
    ".py": { icon: "🐍", color: chalk.rgb(55, 118, 171) }, // Python Blue
    ".cs": { icon: "💜", color: chalk.rgb(155, 79, 150) }, // C# Purple
    ".cpp": { icon: "🟦", color: chalk.rgb(0, 89, 156) }, // C++ Dark Blue
    ".c": { icon: "🏢", color: chalk.rgb(168, 185, 204) }, // C Greyish Blue
    ".sh": { icon: "🐚", color: chalk.rgb(78, 170, 37) }, // Shell Green
    ".bat": { icon: "🖥️ ", color: chalk.rgb(150, 150, 150) }, // Batch Gray
    ".rs": { icon: "🦀", color: chalk.rgb(222, 165, 132) }, // Rust Orange/Brown
    ".ps1": { icon: "🐚", color: chalk.rgb(42, 101, 199) }, // PowerShell Blue
    ".wasm": { icon: "🕸️ ", color: chalk.rgb(101, 79, 240) }, // Wasm Purple

    // --- Web & Styles ---
    ".html": { icon: "🌐", color: chalk.rgb(227, 76, 38) }, // HTML5 Red/Orange
    ".css": { icon: "🎨", color: chalk.rgb(86, 61, 124) }, // CSS Purplish (or Blue 38, 77, 228)
    ".scss": { icon: "💅", color: chalk.rgb(205, 103, 153) }, // Sass Pink
    ".less": { icon: "💅", color: chalk.rgb(29, 54, 93) }, // Less Dark Blue

    // --- Config & System Files ---
    ".json": { icon: "⚙️ ", color: chalk.rgb(251, 192, 45) }, // JSON Yellow
    ".npmrc": { icon: "🛑", color: chalk.rgb(203, 56, 55) }, // NPM Red
    ".nvmrc": { icon: "🌿", color: chalk.rgb(76, 175, 80) }, // Node Greenish
    ".toml": { icon: "🛠️ ", color: chalk.rgb(156, 66, 33) }, // TOML Rust-like
    ".yaml": { icon: "📝", color: chalk.rgb(203, 58, 140) }, // YAML Magenta
    ".yml": { icon: "📝", color: chalk.rgb(203, 58, 140) }, // YAML Magenta
    ".env": { icon: "🔑", color: chalk.rgb(0, 255, 127) }, // Secret Spring Green
    ".sql": { icon: "🗄️ ", color: chalk.rgb(242, 145, 17) }, // SQL Database Orange
    ".dockerfile": { icon: "🐳", color: chalk.rgb(36, 150, 237) }, // Docker Blue
    "docker-compose.yml": { icon: "🐳", color: chalk.rgb(36, 150, 237) },
    ".tsbuildinfo": { icon: "🕒", color: chalk.rgb(100, 100, 100) }, // Dim Gray
    ".log": { icon: "📋", color: chalk.rgb(128, 128, 128) }, // Log Gray

    // --- Media (Images, Video, Audio) ---
    ".png": { icon: "🖼️ ", color: chalk.rgb(144, 238, 144) }, // Light Green
    ".jpg": { icon: "🖼️ ", color: chalk.rgb(144, 238, 144) },
    ".jpeg": { icon: "🖼️ ", color: chalk.rgb(144, 238, 144) },
    ".ico": { icon: "🖼️ ", color: chalk.rgb(255, 215, 0) }, // Gold
    ".gif": { icon: "🎞️ ", color: chalk.rgb(255, 105, 180) }, // Hot Pink
    ".svg": { icon: "📐", color: chalk.rgb(255, 165, 0) }, // SVG Orange
    ".webp": { icon: "🖼️ ", color: chalk.rgb(144, 238, 144) },
    ".mp4": { icon: "🎬", color: chalk.rgb(255, 69, 0) }, // Red-Orange
    ".mkv": { icon: "🎬", color: chalk.rgb(255, 69, 0) },
    ".mp3": { icon: "🎵", color: chalk.rgb(186, 85, 211) }, // Medium Orchid
    ".wav": { icon: "🎵", color: chalk.rgb(186, 85, 211) },

    // --- Documentation & Archives ---
    ".md": { icon: "📖", color: chalk.rgb(200, 200, 200) }, // Markdown White-ish
    ".pdf": { icon: "📕", color: chalk.rgb(244, 15, 2) }, // Adobe Red
    ".zip": { icon: "🤐", color: chalk.rgb(255, 200, 100) }, // Archive Orange
    ".rar": { icon: "🤐", color: chalk.rgb(255, 200, 100) },
    ".7z": { icon: "🤐", color: chalk.rgb(255, 200, 100) },
    ".tar": { icon: "📦", color: chalk.rgb(210, 180, 140) }, // Tan/Box color
    ".gz": { icon: "📦", color: chalk.rgb(210, 180, 140) },
    ".txt": { icon: "📄", color: chalk.rgb(240, 240, 240) }, // Pure Text White
    ".lock": { icon: "🔒", color: chalk.rgb(80, 80, 80) }, // Dark Gray
    license: { icon: "📜", color: chalk.rgb(255, 223, 0) }, // Legal Gold

    // --- Git & Tools ---
    ".gitignore": { icon: "🚫", color: chalk.rgb(240, 80, 51) }, // Git Red/Orange
    ".gitattributes": { icon: "📂", color: chalk.rgb(100, 100, 100) },
    ".gitkeep": { icon: "📂", color: chalk.rgb(100, 100, 100) },

    // --- Civil Engineering & Technical (Erzysh specialized) ---
    ".dwg": { icon: "📐", color: chalk.rgb(0, 0, 255) }, // AutoCAD Blue
    ".dxf": { icon: "📏", color: chalk.rgb(0, 255, 255) }, // Cyan (Common CAD layer)
    ".xlsx": { icon: "📊", color: chalk.rgb(33, 115, 70) }, // Excel Green
    ".xls": { icon: "📊", color: chalk.rgb(33, 115, 70) },
    ".csv": { icon: "📑", color: chalk.rgb(100, 200, 100) }, // CSV Lighter Green
    ".doc": { icon: "📄", color: chalk.rgb(43, 87, 154) }, // Word Blue
    ".docx": { icon: "📄", color: chalk.rgb(43, 87, 154) },
  };

  public async execute(args: string[]): Promise<void> {
    const targetDir = args[0] || process.cwd();
    const config = await ConfigManager.load(process.cwd());

    let depthInput = args[1];

    if (!depthInput) {
      // ITUNG DULU DEPTH-NYA DISINI
      this.log(chalk.yellow("🔍 Scanning project structure..."));
      const actualMaxDepth = await this.calculateMaxDepth(targetDir, config);

      this.log(
        chalk.green(`✅ Total depth detected: ${actualMaxDepth} levels.`),
      );

      const answer = await this.askQuestion(
        chalk.cyan(
          `👉 Enter depth (1-${actualMaxDepth}) or press Enter for unlimited: `,
        ),
      );
      depthInput = answer.trim();
    }
    const maxDepth = depthInput !== "" ? parseInt(depthInput, 10) : null;
    const folderName = basename(targetDir);
    this.createBox(`📂 Structure of: ${folderName}`, "Tree Visualizer");

    // if (maxDepth !== null) {
    //   this.info(`🔍 Limiting depth to: ${maxDepth}`);
    // }

    this.log(chalk.cyan(`📁 ${folderName}`));

    // Tambahin parameter 0 (current depth) di renderTree
    await this.renderTree(targetDir, "", config, 0, maxDepth);
  }
  private async renderTree(
    dir: string,
    prefix: string,
    config: AppConfig,
    currentDepth: number,
    maxDepth: number | null,
  ): Promise<void> {
    if (maxDepth !== null && currentDepth >= maxDepth) return;

    try {
      // 1. Gunakan { withFileTypes: true } untuk menghindari panggil stat() manual pada setiap file
      // Ini jauh lebih hemat syscall ke OS.
      const entries = await readdir(dir, { withFileTypes: true });

      const filtered = entries
        .filter((entry) => {
          const name = entry.name;
          if (name.startsWith(".") && name !== ".gitignore" && name !== ".env")
            return false;
          if (config.ignoredPatterns.has(name)) return false;
          return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
        const name = entry.name;
        const fullPath = join(dir, name);
        const isLast = i === filtered.length - 1;
        const isDirectory = entry.isDirectory();

        // UI Logic
        let icon = "📄";
        let label = name;
        let sizeLabel = "";

        if (isDirectory) {
          icon = this.folderMap[name.toLowerCase()] || "📁";
          label = chalk.bold.blue(`${name}/`);
        } else {
          // Hanya panggil stat() jika itu FILE (untuk dapet size)
          // Folder tidak butuh size di tree-mu
          const s = await stat(fullPath);
          const ext = extname(name).toLowerCase();
          const fileName = name.toLowerCase();
          // Cek berdasarkan nama file utuh dulu (buat Dockerfile/npmrc), baru cek extension
          const meta = this.extMap[fileName] || this.extMap[ext];
          icon = meta ? meta.icon : "📄";
          label = meta ? meta.color(name) : chalk.white(name);
          sizeLabel = chalk.dim(` [${this.formatBytes(s.size)}]`);
        }

        const connector = isLast ? "└── " : "├── ";
        this.log(`${prefix}${connector}${icon} ${label}${sizeLabel}`);

        if (isDirectory) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");

          // Update fungsi renderTree di bagian Logic Depth Limit:
          // Cari baris: if (maxDepth !== null && currentDepth + 1 >= maxDepth)

          if (maxDepth !== null && currentDepth + 1 >= maxDepth) {
            const summary = await this.getFolderSummary(fullPath, config);
            if (summary) {
              this.log(`${newPrefix}└── ${chalk.dim("...")}${summary}`);
            }
          } else {
            await this.renderTree(
              fullPath,
              newPrefix,
              config,
              currentDepth + 1,
              maxDepth,
            );
          }
        }
      }
    } catch (err) {
      this.error(`Error: ${(err as Error).message}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
  }

  private async askQuestion(query: string): Promise<string> {
    const rl = (await import("node:readline")).createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) =>
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans);
      }),
    );
  }

  private async calculateMaxDepth(
    dir: string,
    config: AppConfig,
    current: number = 1,
  ): Promise<number> {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      const folders = entries.filter(
        (e) => e.isDirectory() && !config.ignoredPatterns.has(e.name),
      );

      if (folders.length === 0) return current;

      const depths = await Promise.all(
        folders.map((f) =>
          this.calculateMaxDepth(join(dir, f.name), config, current + 1),
        ),
      );

      return Math.max(...depths);
    } catch {
      return current;
    }
  }
  // --- src/commands/tree.ts ---

  // Tambahkan di dalam class TreeCommand

  private async getFolderSummary(
    dir: string,
    config: AppConfig,
  ): Promise<string> {
    const fileStats: Record<string, number> = {};
    let totalFiles = 0;

    const gather = async (currentDir: string) => {
      const entries = await readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (config.ignoredPatterns.has(entry.name)) continue;

        if (entry.isDirectory()) {
          await gather(join(currentDir, entry.name));
        } else {
          const ext = extname(entry.name).toLowerCase() || entry.name;
          fileStats[ext] = (fileStats[ext] || 0) + 1;
          totalFiles++;
        }
      }
    };

    try {
      await gather(dir);

      if (totalFiles === 0) return "";

      const limit = 5;

      // Sort ekstensi berdasarkan jumlah terbanyak
      const sortedExts = Object.entries(fileStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit); // Ambil top 3 ekstensi aja biar gak kepanjangan

      const extLabels = sortedExts.map(([ext, count]) => {
        const meta = this.extMap[ext];
        // Kalau ekstensi tidak ada di map, pakai warna putih standar
        const coloredExt = meta ? meta.color(ext) : chalk.white(ext);
        return `${coloredExt}${chalk.dim(` x${count}`)}`;
      });

      const moreText = Object.keys(fileStats).length > limit ? ", etc." : "";
      return (
        chalk.dim(` ${totalFiles} files (`) +
        extLabels.join(chalk.dim(", ")) +
        chalk.dim(`${moreText})`)
      );
    } catch {
      return "";
    }
  }
}

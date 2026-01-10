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
    utils: "🛠️ ",
    commands: "🐚",
    managers: "👔",
    types: "🏷️ ",
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
    // Logic & Scripts
    ".ts": { icon: "🟦", color: chalk.blueBright },
    ".tsx": { icon: "⚛️ ", color: chalk.cyanBright },
    ".js": { icon: "🟨", color: chalk.yellow },
    ".jsx": { icon: "⚛️ ", color: chalk.cyan },
    ".py": { icon: "🐍", color: chalk.green },
    ".cs": { icon: "💜", color: chalk.magentaBright },

    // Web Styles & Markup
    ".css": { icon: "🎨", color: chalk.blue },
    ".scss": { icon: "👗", color: chalk.magenta },
    ".html": { icon: "🌐", color: chalk.redBright },

    // Media - Images
    ".png": { icon: "🖼️ ", color: chalk.greenBright },
    ".jpg": { icon: "🖼️ ", color: chalk.greenBright },
    ".jpeg": { icon: "🖼️ ", color: chalk.greenBright },
    ".gif": { icon: "🎞️ ", color: chalk.yellowBright },
    ".svg": { icon: "📐", color: chalk.yellowBright },
    ".webp": { icon: "🖼️ ", color: chalk.greenBright },

    // Media - Video & Audio
    ".mp4": { icon: "🎬", color: chalk.redBright },
    ".mkv": { icon: "🎬", color: chalk.redBright },
    ".mp3": { icon: "🎵", color: chalk.magentaBright },
    ".wav": { icon: "🎵", color: chalk.magentaBright },

    // Data & Config
    ".json": { icon: "⚙️ ", color: chalk.yellowBright },
    ".yaml": { icon: "📝", color: chalk.gray },
    ".yml": { icon: "📝", color: chalk.gray },
    ".env": { icon: "🔑", color: chalk.yellowBright },
    ".sql": { icon: "🗄️ ", color: chalk.cyan },

    // Documentation & Archives
    ".md": { icon: "📖", color: chalk.whiteBright },
    ".pdf": { icon: "📕", color: chalk.red },
    ".zip": { icon: "🤐", color: chalk.yellow },
    ".rar": { icon: "🤐", color: chalk.yellow },
    ".7z": { icon: "🤐", color: chalk.yellow },

    // Git & Tools
    ".gitignore": { icon: "🚫", color: chalk.red },
    ".dockerfile": { icon: "🐳", color: chalk.blue },
    ".lock": { icon: "🔒", color: chalk.gray },
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

    if (maxDepth !== null) {
      this.info(`🔍 Limiting depth to: ${maxDepth}`);
    }

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
          const ext = extname(name).toLowerCase() || name;
          const meta = this.extMap[ext];
          icon = meta ? meta.icon : "📄";
          label = meta ? meta.color(name) : chalk.white(name);
          sizeLabel = chalk.dim(` [${this.formatBytes(s.size)}]`);
        }

        const connector = isLast ? "└── " : "├── ";
        this.log(`${prefix}${connector}${icon} ${label}${sizeLabel}`);

        if (isDirectory) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");

          if (maxDepth !== null && currentDepth + 1 >= maxDepth) {
            // OPTIMASI: Cek isi folder tanpa readdir penuh lagi
            // Kita cuma butuh tahu "apakah ada isinya?"
            const subEntries = await readdir(fullPath);
            if (subEntries.length > 0) {
              this.log(`${newPrefix}└── ${chalk.dim("...")}`);
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
}

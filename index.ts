/**
 * 🚀 PROMPTER GEN V11.4 [CLI SETUP UPDATE]
 * Author: Rizqi Lasheva (Rilaptra)
 * Updates:
 * - FEATURE: Added 'setup' command to install 'digest' globally
 * - SYSTEM: Auto-generates .bat shim and updates Windows PATH env
 */

import { join, relative, dirname, extname, basename, resolve, isAbsolute } from "node:path";
import { readdir, stat, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// 📦 UI MODULES
import chalk from "chalk";
import ora from "ora";
import Boxen from "boxen";
import Table from "cli-table3";

// --- ⚙️ SYSTEM ---
const SYSTEM = {
  VERSION: "11.4.0-setup",
  FILENAME: fileURLToPath(import.meta.url),
  SCRIPT_DIR: dirname(fileURLToPath(import.meta.url)),
  OUT_DIR: join(dirname(fileURLToPath(import.meta.url)), "generated"),
  BIN_DIR: join(dirname(fileURLToPath(import.meta.url)), "bin"),
  CONCURRENCY: 64,
  CHUNK_SIZE: 64 * 1024,
};

// --- 📝 CONFIG DEFAULTS ---
const DEFAULT_CONFIG = {
  ignoredPatterns: [
    "node_modules", ".git", ".next", "dist", "build", "out", 
    "target", "bin", "obj", ".output", "coverage", ".vercel", 
    ".vscode", ".idea", "__pycache__", ".env", "pnpm-lock.yaml", 
    "yarn.lock", "bun.lockb", "bun.lock", "package-lock.json", 
    "assets", "public", "jspm_packages", "vendor", ".contentlayer"
  ],
  ignoredExts: [
    ".png", ".jpg", ".jpeg", ".svg", ".ico", ".webp", ".gif", 
    ".mp4", ".mp3", ".pdf", ".zip", ".tar", ".gz", ".rar", 
    ".exe", ".dll", ".bin", ".so", ".dylib", ".sys", ".sqlite", ".db",
    ".otf", ".ttf", ".woff", ".woff2", ".eot",
    ".o", ".obj", ".rmeta", ".rlib", ".d", ".pdb", ".lock", ".tsbuildinfo"
  ],
  maxFileSizeKB: 500
};

// --- 🛠️ TYPES & UTILS ---
interface AppConfig {
  ignoredPatterns: Set<string>;
  ignoredExts: Set<string>;
  maxFileSize: number;
}
interface ScanStats {
  files: { path: string, relPath: string, size: number, ext: string }[];
  tree: string[];
  skippedCount: number;
  skippedSize: number;
  totalSize: number;
  extStats: Record<string, { count: number; size: number }>;
  duration: string;
}

class Utils {
  static formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${["B", "KB", "MB", "GB"][i]}`;
  }
  static estimateTokens(bytes: number): string {
    const tokens = Math.ceil(bytes / 4);
    if (tokens > 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
  }
  static openFile(path: string) {
    const cmd = process.platform === 'win32' ? 'explorer' : 'open';
    spawn(cmd, [path], { stdio: 'ignore', detached: true }).unref();
  }
  static resolvePath(input: string): string | null {
    if (isAbsolute(input)) return existsSync(input) ? input : null;
    let p = resolve(process.cwd(), input);
    if (existsSync(p)) return p;
    p = resolve(process.cwd(), "..", input);
    if (existsSync(p)) return p;
    return null;
  }
  static async promptYesNo(question: string): Promise<boolean> {
    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    return new Promise((resolve) => {
      process.stdin.once('data', (data) => {
        const key = data.toString().trim().toLowerCase();
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(key !== 'n');
      });
    });
  }
}

// --- 🧠 CONFIG LOAD ---
class ConfigManager {
  static async load(targetDir: string): Promise<AppConfig> {
    const final = {
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSizeKB * 1024
    };
    const targetCfgPath = join(targetDir, "prompter.config.json");
    const scriptCfgPath = join(SYSTEM.SCRIPT_DIR, "prompter.config.json");
    let cfgFile = null;
    if (await Bun.file(targetCfgPath).exists()) cfgFile = targetCfgPath;
    else if (await Bun.file(scriptCfgPath).exists()) cfgFile = scriptCfgPath;
    if (cfgFile) {
      try {
        const user = await Bun.file(cfgFile).json();
        const patterns = user.ignorePatterns || user.ignoredPatterns;
        if (Array.isArray(patterns)) patterns.forEach((x: string) => final.ignoredPatterns.add(x));
        const exts = user.ignoreExtensions || user.ignoredExts || user.ignoreExts;
        if (Array.isArray(exts)) exts.forEach((x: string) => final.ignoredExts.add(x));
        const maxKB = user.defaultLimitKB || user.maxFileSizeKB;
        if (maxKB) final.maxFileSize = maxKB * 1024;
        console.log(chalk.dim(`   ⚙️  Loaded config from: ${basename(cfgFile)}`));
      } catch (e) { 
        console.log(chalk.yellow("   ⚠️  Config error (JSON Invalid), using defaults.")); 
      }
    }
    try {
      const gitPath = join(targetDir, ".gitignore");
      const f = Bun.file(gitPath);
      if (await f.exists()) {
        const txt = await f.text();
        txt.split("\n").forEach(line => {
          const l = line.trim();
          if (l && !l.startsWith("#")) final.ignoredPatterns.add(l.replace(/^\/|\/$/g, ""));
        });
      }
    } catch {}
    return final;
  }
}

// --- 🔍 SCANNER ---
class Scanner {
  static async run(dir: string, cfg: AppConfig): Promise<ScanStats> {
    const start = performance.now();
    const stats: ScanStats = {
      files: [], tree: [], skippedCount: 0, skippedSize: 0, totalSize: 0, extStats: {}, duration: ""
    };
    await this.walk(dir, dir, cfg, stats, "");
    stats.duration = (performance.now() - start).toFixed(0);
    return stats;
  }
  static async walk(base: string, current: string, cfg: AppConfig, stats: ScanStats, prefix: string) {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); } catch { return; }
    const valid = entries.filter(e => {
      if (e.name.startsWith(".") && e.name !== ".gitignore" && e.name !== ".env.example") return false;
      if (cfg.ignoredPatterns.has(e.name)) return false;
      return true;
    }).sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
    for (const [i, e] of valid.entries()) {
      const isLast = i === valid.length - 1;
      const path = join(current, e.name);
      if (stats.tree.length < 800) stats.tree.push(`${prefix}${isLast ? "└── " : "├── "}${e.name}`);
      else if (stats.tree.length === 800) stats.tree.push(`${prefix}   ... (truncated)`);
      if (e.isDirectory()) {
        await this.walk(base, path, cfg, stats, prefix + (isLast ? "    " : "│   "));
      } else {
        const ext = extname(e.name).toLowerCase();
        if (cfg.ignoredExts.has(ext) || cfg.ignoredPatterns.has(e.name)) continue;
        try {
          const s = await stat(path);
          if (s.size > cfg.maxFileSize) {
            stats.skippedCount++;
            stats.skippedSize += s.size;
            continue;
          }
          stats.files.push({ path, relPath: relative(base, path), size: s.size, ext: ext.slice(1) || "txt" });
          stats.totalSize += s.size;
          if (!stats.extStats[ext]) stats.extStats[ext] = { count: 0, size: 0 };
          stats.extStats[ext].count++;
          stats.extStats[ext].size += s.size;
        } catch {}
      }
    }
  }
}

// --- 🔥 APP CONTROLLER ---
class AppController {
  private command: string;

  constructor() {
    this.command = Bun.argv[2] || ".";
  }

  public async run() {
    console.clear();

    switch (this.command) {
      case "help":
      case "--help":
      case "-h":
        this.showHelp();
        break;
      case "config":
        await this.generateConfig();
        break;
      case "setup":  // <--- NEW COMMAND
        await this.setupCLI();
        break;
      case "open":
        this.openSource();
        break;
      default:
        await this.scanDirectory(this.command);
        break;
    }
  }

  // --- NEW: SETUP GLOBAL CLI ---
  private async setupCLI() {
    console.log(Boxen(chalk.cyan("🛠️  PROMPTER SETUP WIZARD"), { padding: 1, borderStyle: "round" }));
    
    if (process.platform !== "win32") {
        console.log(chalk.yellow("⚠️  This automatic setup is currently optimized for Windows."));
        console.log("For Linux/Mac, please alias this script manually.");
        process.exit(0);
    }

    const spinner = ora("Configuring environment...").start();

    try {
        // 1. Create bin directory if not exists
        if (!existsSync(SYSTEM.BIN_DIR)) {
            await mkdir(SYSTEM.BIN_DIR, { recursive: true });
        }

        // 2. Write digest.bat
        const batPath = join(SYSTEM.BIN_DIR, "digest.bat");
        // Using SYSTEM.FILENAME to ensure it points to THIS exact file dynamically
        const batContent = `@echo off\nbun "${SYSTEM.FILENAME}" "%*"`; 
        
        await Bun.write(batPath, batContent);
        spinner.succeed(`Created shim: ${chalk.green("bin/digest.bat")}`);

        // 3. Update Path via PowerShell
        spinner.start("Updating System PATH...");
        
        const psCommand = `
        $target = "${SYSTEM.BIN_DIR}";
        $current = [Environment]::GetEnvironmentVariable("Path", "User");
        if ($current -notlike "*$target*") {
            [Environment]::SetEnvironmentVariable("Path", $current + ";$target", "User");
            Write-Output "UPDATED";
        } else {
            Write-Output "SKIPPED";
        }
        `;

        const proc = spawn("powershell", ["-Command", psCommand]);
        
        proc.stdout.on('data', (data) => {
            const out = data.toString().trim();
            if (out === "UPDATED") {
                spinner.succeed(chalk.green("Successfully added ./bin to User PATH!"));
                console.log(chalk.bgRed.white.bold("\n ⚠️  RESTART REQUIRED ") + " Please restart your terminal/VSCode to use 'digest' command.");
            } else {
                spinner.succeed(chalk.green("PATH is already configured."));
            }
            process.exit(0);
        });

    } catch (error) {
        spinner.fail(chalk.red("Setup failed."));
        console.error(error);
        process.exit(1);
    }
  }

  private showHelp() {
    console.log(chalk.cyan(`
  ____  ____  ____  __  __  ____  ____  ____  ____ 
 (  _ \\(  _ \\(  _ \\(  \\/  )(  _ \\(_  _)(  __)(  _ \\
  ) __/ )   / )(_) ))    (  ) __/  )(   ) _)  )   /
 (__)  (__\\_)(____/(_/\\/\\_)(__)   (__) (____)(__\\_) v${SYSTEM.VERSION}
    `));
    console.log(Boxen(chalk.white(`🚀 The Ultimate Codebase Digester for LLM Context\nMade with ❤️  by ${chalk.bold("Rilaptra")}`), { padding: 1, margin: { top: 0, bottom: 1 }, borderStyle: "round", borderColor: "cyan", textAlignment: "center" }));
    console.log(chalk.bold.yellow(" 🎮 USAGE"));
    console.log(`   ${chalk.green("$")} ${chalk.white("digest")} ${chalk.dim("[target_path]")}\n`);
    const helpTable = new Table({ head: [chalk.cyan('Command'), chalk.cyan('Description')], colWidths: [20, 50], style: { head: [], border: [] } });
    helpTable.push(
        ['setup', 'Install "digest" command to system'], // Added to help
        ['.', 'Scan current directory'],
        ['[path]', 'Scan specific directory'],
        ['config', 'Generate or reset prompter.config.json'],
        ['open', 'Open this script source code'],
        ['help', 'Show this manual']
    );
    console.log(helpTable.toString());
    process.exit(0);
  }

  private async generateConfig() {
    const cfgPath = join(process.cwd(), "prompter.config.json");
    await Bun.write(cfgPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    console.log(chalk.green(`\n✅ Config generated at: ${cfgPath}`));
    Utils.openFile(cfgPath);
    process.exit(0);
  }

  private openSource() {
    console.log(chalk.cyan("📂 Opening source code..."));
    Utils.openFile(SYSTEM.FILENAME);
    process.exit(0);
  }

  private async scanDirectory(path: string) {
    const targetDir = Utils.resolvePath(path);
    if (!targetDir) {
      console.log(chalk.red(`\n❌ ERROR: Directory not found -> "${path}"`));
      process.exit(1);
    }

    const repoName = basename(targetDir);
    console.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    
    const spinner = ora(`Analyzing ${chalk.bold(repoName)}...`).start();
    const config = await ConfigManager.load(targetDir);
    const stats = await Scanner.run(targetDir, config);
    spinner.stop();

    if (stats.files.length === 0) {
      console.log(chalk.red(`❌ No valid files found in ${targetDir}`));
      process.exit(1);
    }

    this.displayReport(stats);

    const shouldWrite = await Utils.promptYesNo(`${chalk.bgCyan.black(" ACTION ")} Write File? ${chalk.dim("(Y/n)")} `);
    if (!shouldWrite) {
      console.log(chalk.dim("Cancelled."));
      process.exit(0);
    }

    await this.writeOutput(stats, repoName);
  }

  private displayReport(stats: ScanStats) {
    console.log("");
    const table = new Table({ head: [chalk.white('Metric'), chalk.white('Value')], colWidths: [20, 35] });
    table.push(
      [chalk.cyan('Total Files'), stats.files.length],
      [chalk.yellow('Context Size'), Utils.formatSize(stats.totalSize)],
      [chalk.magenta('Est. Tokens'), Utils.estimateTokens(stats.totalSize)],
      [chalk.red('Skipped'), `${stats.skippedCount} files (${Utils.formatSize(stats.skippedSize)})`]
    );
    console.log(table.toString());

    if (Object.keys(stats.extStats).length > 0) {
      console.log(`\n${chalk.dim('Distribution:')}`);
      Object.entries(stats.extStats).sort((a, b) => b[1].size - a[1].size).slice(0, 5)
        .forEach(([ext, d]) => {
          const pct = ((d.size / stats.totalSize) * 100).toFixed(1);
          console.log(`  ${chalk.cyan(ext.padEnd(8))} : ${d.count.toString().padEnd(5)} files | ${chalk.yellow(Utils.formatSize(d.size))} (${pct}%)`);
        });
    }
    console.log("");
  }

  private async writeOutput(stats: ScanStats, repoName: string) {
    const outPath = join(SYSTEM.OUT_DIR, `DIGEST_${repoName}_${Date.now()}.md`);
    if (!existsSync(SYSTEM.OUT_DIR)) {
      await Bun.write(join(SYSTEM.OUT_DIR, ".keep"), "");
    }
    
    const writer = Bun.file(outPath).writer({ highWaterMark: SYSTEM.CHUNK_SIZE });
    writer.write(`# ${repoName}\n\n## Tree\n\`\`\`\n${stats.tree.join("\n")}\n\`\`\`\n\n## Code\n`);
    
    const writeSpin = ora("Writing...").start();
    let done = 0;
    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);
      const contents = await Promise.all(chunk.map(async f => {
        try { return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${await Bun.file(f.path).text()}\n\`\`\`\n`; } 
        catch { return ""; }
      }));
      for (const c of contents) writer.write(c);
      done += chunk.length;
      writeSpin.text = `Writing ${Math.round((done / stats.files.length) * 100)}%`;
    }
    writer.end();
    writeSpin.succeed(chalk.green(`Saved: ${basename(outPath)}`));
    
    console.log(chalk.dim("   📂 Opening output directory..."));
    Utils.openFile(SYSTEM.OUT_DIR);
  }
}

// --- 🎮 MAIN EXECUTION ---
(async () => {
  const app = new AppController();
  await app.run();
})();
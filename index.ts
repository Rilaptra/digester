/**
 * 🚀 PROMPTER GEN V12.0 [AI OPS UPDATE]
 * Author: Rizqi Lasheva (Rilaptra)
 * Updates:
 * - FEATURE: 'commit' command (AI-driven Auto Commit, Changelog, Versioning)
 * - FEATURE: 'set-key' & 'set-model' for Global AI Config
 * - SYSTEM: Integrated Gemini API Client
 */

import {
  join,
  relative,
  dirname,
  extname,
  basename,
  resolve,
  isAbsolute,
} from "node:path";
import { readdir, stat, mkdir } from "node:fs/promises";
import { existsSync, writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";

// 📦 UI MODULES
import chalk from "chalk";
import ora from "ora";
import Boxen from "boxen";
import Table from "cli-table3";

// --- ⚙️ SYSTEM ---
const SYSTEM = {
  VERSION: "12.0.0-ai",
  FILENAME: fileURLToPath(import.meta.url),
  SCRIPT_DIR: dirname(fileURLToPath(import.meta.url)),
  OUT_DIR: join(dirname(fileURLToPath(import.meta.url)), "generated"),
  BIN_DIR: join(dirname(fileURLToPath(import.meta.url)), "bin"),
  AUTH_FILE: join(dirname(fileURLToPath(import.meta.url)), "auth.config.json"), // Global auth storage
  CONCURRENCY: 64,
  CHUNK_SIZE: 64 * 1024,
};

// --- 📝 CONFIG DEFAULTS ---
const DEFAULT_CONFIG = {
  ignoredPatterns: [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "out",
    "target",
    "bin",
    "obj",
    ".output",
    "coverage",
    ".vercel",
    ".vscode",
    ".idea",
    "__pycache__",
    ".env",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "package-lock.json",
    "assets",
    "public",
    "jspm_packages",
    "vendor",
    ".contentlayer",
    "prompter.config.json",
    "auth.config.json", // Added explicit ignores
  ],
  ignoredExts: [
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".ico",
    ".webp",
    ".gif",
    ".mp4",
    ".mp3",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".exe",
    ".dll",
    ".bin",
    ".so",
    ".dylib",
    ".sys",
    ".sqlite",
    ".db",
    ".otf",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    ".o",
    ".obj",
    ".rmeta",
    ".rlib",
    ".d",
    ".pdb",
    ".lock",
    ".tsbuildinfo",
  ],
  maxFileSizeKB: 500,
};

// --- 🛠️ TYPES & UTILS ---
interface AppConfig {
  ignoredPatterns: Set<string>;
  ignoredExts: Set<string>;
  maxFileSize: number;
}
interface ScanStats {
  files: { path: string; relPath: string; size: number; ext: string }[];
  tree: string[];
  skippedCount: number;
  skippedSize: number;
  totalSize: number;
  extStats: Record<string, { count: number; size: number }>;
  duration: string;
}
interface AuthConfig {
  apiKey?: string;
  model?: string;
}
interface AICommitResponse {
  commitMessage: string;
  changelog: string;
  bump: "major" | "minor" | "patch" | "none";
}

class Utils {
  static formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2.2)} ${
      ["B", "KB", "MB", "GB"][i]
    }`;
  }
  static estimateTokens(bytes: number): string {
    const tokens = Math.ceil(bytes / 2);
    if (tokens > 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
    return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
  }
  static openFile(path: string) {
    const cmd = process.platform === "win32" ? "explorer" : "open";
    spawn(cmd, [path], { stdio: "ignore", detached: true }).unref();
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
      process.stdin.once("data", (data) => {
        const key = data.toString().trim().toLowerCase();
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write("\n");
        resolve(key !== "n");
      });
    });
  }
  static async promptSelect(
    question: string,
    options: string[]
  ): Promise<string> {
    console.log(question);
    options.forEach((opt, idx) =>
      console.log(`  ${chalk.cyan(idx + 1)}. ${opt}`)
    );
    process.stdout.write(chalk.yellow("  > Select number: "));
    process.stdin.setRawMode(false); // Text input mode
    process.stdin.resume();
    return new Promise((resolve) => {
      process.stdin.once("data", (data) => {
        const idx = parseInt(data.toString().trim()) - 1;
        process.stdin.pause();
        if (isNaN(idx) || idx < 0 || idx >= options.length) {
          console.log(
            chalk.red("Invalid selection. Defaulting to first option.")
          );
          resolve(options[0]);
        } else {
          resolve(options[idx]);
        }
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
      maxFileSize: DEFAULT_CONFIG.maxFileSizeKB * 1024,
    };
    const targetCfgPath = join(targetDir, "prompter.config.json");
    if (await Bun.file(targetCfgPath).exists()) {
      try {
        const user = await Bun.file(targetCfgPath).json();
        const patterns = user.ignorePatterns || user.ignoredPatterns;
        if (Array.isArray(patterns))
          patterns.forEach((x: string) => final.ignoredPatterns.add(x));
        const exts =
          user.ignoreExtensions || user.ignoredExts || user.ignoreExts;
        if (Array.isArray(exts))
          exts.forEach((x: string) => final.ignoredExts.add(x));
        const maxKB = user.defaultLimitKB || user.maxFileSizeKB;
        if (maxKB) final.maxFileSize = maxKB * 1024;
      } catch (e) {
        console.log(
          chalk.yellow("   ⚠️  Config error (JSON Invalid), using defaults.")
        );
      }
    }
    // Gitignore logic
    try {
      const gitPath = join(targetDir, ".gitignore");
      const f = Bun.file(gitPath);
      if (await f.exists()) {
        const txt = await f.text();
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
  static getAuth(): AuthConfig {
    if (existsSync(SYSTEM.AUTH_FILE)) {
      try {
        return JSON.parse(readFileSync(SYSTEM.AUTH_FILE, "utf-8"));
      } catch {
        return {};
      }
    }
    return {};
  }
  static saveAuth(cfg: AuthConfig) {
    const current = this.getAuth();
    const final = { ...current, ...cfg };
    writeFileSync(SYSTEM.AUTH_FILE, JSON.stringify(final, null, 2));
  }
}

// --- 🤖 AI MANAGER ---
class AIManager {
  private static baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  static async fetchModels(key: string): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models?key=${key}`);
      const data = (await res.json()) as any;
      if (data.error) throw new Error(data.error.message);
      // Filter only Gemini models that support content generation
      return (data.models || [])
        .filter(
          (m: any) =>
            m.name.includes("gemini") &&
            m.supportedGenerationMethods?.includes("generateContent")
        )
        .map((m: any) => m.name.replace("models/", ""))
        .sort((a: string, b: string) => b.localeCompare(a)); // Newest first
    } catch (e) {
      throw new Error(`Failed to fetch models: ${e}`);
    }
  }

  static async generateCommitDetails(
    diff: string,
    auth: AuthConfig
  ): Promise<AICommitResponse> {
    if (!auth.apiKey)
      throw new Error("API Key not found. Run 'digest set-key <KEY>' first.");
    const model = auth.model || "gemini-1.5-flash";

    const prompt = `
        You are a Senior DevOps Engineer. Analyze the following 'git diff'. 
        Return a valid JSON object ONLY (no markdown formatting, no code blocks) with:
        1. "commitMessage": A conventional commit message (type(scope): description).
        2. "changelog": A concise bullet point for a changelog.
        3. "bump": One of "major", "minor", "patch", or "none" based on SemVer rules.

        DIFF:
        ${diff.substring(0, 30000)} ${
      diff.length > 30000 ? "...(truncated)" : ""
    }
        `;

    try {
      const res = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${auth.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );
      const data = (await res.json()) as any;
      if (data.error) throw new Error(data.error.message);

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Empty response from AI");

      return JSON.parse(text);
    } catch (e) {
      throw new Error(`AI Generation failed: ${e}`);
    }
  }
}

// --- 🧱 GIT MANAGER (Target: SELF / Source Dir) ---
class GitManager {
  static prepareAndGetDiff(): string {
    try {
      const targetDir = SYSTEM.SCRIPT_DIR;
      const gitDir = join(targetDir, ".git");

      if (!existsSync(gitDir)) {
        console.log(
          chalk.yellow(
            `⚠️  Git not found in tool dir (${targetDir}). Initializing...`
          )
        );
        execSync("git init", { cwd: targetDir, stdio: "ignore" });
      }

      execSync("git add .", { cwd: targetDir, stdio: "ignore" });
      return execSync("git diff --cached", {
        cwd: targetDir,
        encoding: "utf-8",
      });
    } catch (e) {
      return "";
    }
  }

  static updateVersion(bumpType: string): string | null {
    const pkgPath = join(SYSTEM.SCRIPT_DIR, "package.json");
    if (!existsSync(pkgPath)) return null;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const oldVer = pkg.version || "0.0.0";
      let [major, minor, patch] = oldVer.split(".").map(Number);

      if (bumpType === "major") {
        major++;
        minor = 0;
        patch = 0;
      } else if (bumpType === "minor") {
        minor++;
        patch = 0;
      } else if (bumpType === "patch") {
        patch++;
      } else return oldVer;

      const newVer = `${major}.${minor}.${patch}`;
      pkg.version = newVer;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

      execSync("git add package.json", {
        cwd: SYSTEM.SCRIPT_DIR,
        stdio: "ignore",
      });
      return newVer;
    } catch {
      return null;
    }
  }

  static async executeCommit(msg: string, tag?: string) {
    const opts = { cwd: SYSTEM.SCRIPT_DIR, stdio: "inherit" as any };
    try {
      execSync(`git commit -m "${msg}"`, opts);

      if (tag) {
        execSync(`git tag v${tag}`, opts);
        console.log(chalk.green(`   🏷️  Tagged v${tag}`));
      }
    } catch (e) {
      console.error(chalk.red("❌ Git commit failed."));
      throw e; // Lempar error biar gak lanjut push
    }
  }

  // 🔥 NEW: AUTO PUSH FUNCTION
  static pushToRemote() {
    const opts = { cwd: SYSTEM.SCRIPT_DIR, stdio: "inherit" as any };
    console.log(chalk.yellow("\n🚀 Pushing to remote (origin)..."));
    try {
      // Push HEAD (current branch) dan tags sekaligus
      execSync("git push origin HEAD --tags", opts);
      console.log(chalk.green("   ✅ Push Success!"));
    } catch (e) {
      console.log(chalk.red("\n❌ Push Failed."));
      console.log(
        chalk.dim("   Check your internet or 'git remote -v' config.")
      );
    }
  }
}

// --- 🔍 SCANNER ---
class Scanner {
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
  static async walk(
    base: string,
    current: string,
    cfg: AppConfig,
    stats: ScanStats,
    prefix: string
  ) {
    let entries;
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
      .sort((a, b) =>
        a.isDirectory() === b.isDirectory()
          ? a.name.localeCompare(b.name)
          : a.isDirectory()
          ? -1
          : 1
      );
    for (const [i, e] of valid.entries()) {
      const isLast = i === valid.length - 1;
      const path = join(current, e.name);
      if (stats.tree.length < 800)
        stats.tree.push(`${prefix}${isLast ? "└── " : "├── "}${e.name}`);
      else if (stats.tree.length === 800)
        stats.tree.push(`${prefix}   ... (truncated)`);
      if (e.isDirectory()) {
        await this.walk(
          base,
          path,
          cfg,
          stats,
          prefix + (isLast ? "    " : "│   ")
        );
      } else {
        const ext = extname(e.name).toLowerCase();
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
  private arg1: string;

  constructor() {
    this.command = Bun.argv[2] || ".";
    this.arg1 = Bun.argv[3] || "";
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
      case "setup":
        await this.setupCLI();
        break;
      case "set-key":
        await this.setApiKey();
        break;
      case "set-model":
        await this.setModel();
        break;
      case "commit":
        await this.aiCommit();
        break;
      case "open":
        this.openSource();
        break;
      default:
        await this.scanDirectory(this.command);
        break;
    }
  }

  // --- FEATURE: AI COMMIT (SELF-UPDATE + PUSH) ---
  private async aiCommit() {
    console.log(
      Boxen(chalk.cyan("🤖 AUTO OPS AGENT (SELF-UPDATE)"), {
        padding: 1,
        borderStyle: "round",
      })
    );
    console.log(chalk.dim(`Target Repo: ${SYSTEM.SCRIPT_DIR}`));

    const auth = ConfigManager.getAuth();
    if (!auth.apiKey) {
      console.log(
        chalk.red("❌ API Key missing. Run 'digest set-key <YOUR_KEY>' first.")
      );
      process.exit(1);
    }

    const spinner = ora("Checking internal changes...").start();
    const diff = GitManager.prepareAndGetDiff();

    if (!diff || diff.trim().length === 0) {
      spinner.fail(
        chalk.yellow("No internal changes detected in Digester repo.")
      );
      process.exit(0);
    }

    spinner.text = `Consulting ${auth.model || "Gemini"}...`;

    try {
      const result = await AIManager.generateCommitDetails(diff, auth);
      spinner.stop();

      console.log(chalk.bold("\n📝 AI Proposal:"));
      console.log(`   ${chalk.cyan("Message")} : ${result.commitMessage}`);
      console.log(
        `   ${chalk.green("Bump")}    : ${result.bump.toUpperCase()}`
      );
      console.log(`   ${chalk.yellow("Log")}     : ${result.changelog}\n`);

      const confirm = await Utils.promptYesNo(
        `${chalk.bgBlue.black(" EXECUTE ")} Commit & Push? ${chalk.dim(
          "(Y/n)"
        )} `
      );

      if (confirm) {
        // 1. Update Version
        let newVer = null;
        if (result.bump !== "none") {
          newVer = GitManager.updateVersion(result.bump);
          if (newVer)
            console.log(
              chalk.green(`   ✅ Updated internal package.json to v${newVer}`)
            );
        }

        // 2. Update Changelog
        const changelogPath = join(SYSTEM.SCRIPT_DIR, "CHANGELOG.md");
        if (!existsSync(changelogPath))
          await Bun.write(changelogPath, "# Changelog\n\n");

        const date = new Date().toISOString().split("T")[0];
        const entry = `\n- [${date}] ${result.changelog}`;
        const currentContent = await Bun.file(changelogPath).text();
        await Bun.write(changelogPath, currentContent + entry);

        execSync("git add CHANGELOG.md", {
          cwd: SYSTEM.SCRIPT_DIR,
          stdio: "ignore",
        });
        console.log(chalk.green(`   ✅ Updated internal CHANGELOG.md`));

        // 3. Commit & Tag
        await GitManager.executeCommit(
          result.commitMessage,
          newVer || undefined
        );

        // 4. 🔥 AUTO PUSH
        GitManager.pushToRemote();

        console.log(chalk.bgGreen.black("\n 🎉 DONE (Committed & Pushed) "));
      } else {
        console.log(chalk.dim("Aborted."));
      }
    } catch (e: any) {
      spinner.fail(chalk.red("AI Error: " + e.message));
    }
    process.exit(0);
  }

  // --- FEATURE: SET API KEY ---
  private async setApiKey() {
    const key = this.arg1;
    if (!key) {
      console.log(chalk.red("Usage: digest set-key <YOUR_GOOGLE_API_KEY>"));
      process.exit(1);
    }
    ConfigManager.saveAuth({ apiKey: key });
    console.log(chalk.green(`\n✅ API Key saved securely in global config.`));
    console.log(chalk.dim(`   Location: ${SYSTEM.AUTH_FILE}`));
    process.exit(0);
  }

  // --- FEATURE: SET MODEL ---
  private async setModel() {
    const auth = ConfigManager.getAuth();
    if (!auth.apiKey) {
      console.log(
        chalk.red("❌ Please set API Key first using 'digest set-key'")
      );
      process.exit(1);
    }

    const spinner = ora("Fetching available Gemini models...").start();
    try {
      const models = await AIManager.fetchModels(auth.apiKey);
      spinner.stop();

      if (models.length === 0) throw new Error("No models found.");

      const selection = await Utils.promptSelect(
        chalk.cyan("\n🤖 Choose AI Model:"),
        models
      );
      ConfigManager.saveAuth({ model: selection });
      console.log(chalk.green(`\n✅ Model set to: ${chalk.bold(selection)}`));
    } catch (e: any) {
      spinner.fail(chalk.red("Failed to list models: " + e.message));
    }
    process.exit(0);
  }

  // --- EXISTING SETUP ---
  private async setupCLI() {
    console.log(
      Boxen(chalk.cyan("🛠️  PROMPTER SETUP WIZARD"), {
        padding: 1,
        borderStyle: "round",
      })
    );
    if (process.platform !== "win32") {
      console.log(
        chalk.yellow("⚠️  Automatic setup is optimized for Windows.")
      );
      process.exit(0);
    }
    const spinner = ora("Configuring environment...").start();
    try {
      if (!existsSync(SYSTEM.BIN_DIR))
        await mkdir(SYSTEM.BIN_DIR, { recursive: true });
      const batPath = join(SYSTEM.BIN_DIR, "digest.bat");
      const batContent = `@echo off\nbun "${SYSTEM.FILENAME}" %*`;
      await Bun.write(batPath, batContent);
      spinner.succeed(`Created shim: ${chalk.green("bin/digest.bat")}`);

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
      proc.stdout.on("data", (data) => {
        if (data.toString().trim() === "UPDATED") {
          spinner.succeed(chalk.green("Added ./bin to User PATH!"));
          console.log(
            chalk.bgRed.white.bold("\n ⚠️  RESTART REQUIRED ") +
              " Please restart terminal."
          );
        } else {
          spinner.succeed(chalk.green("PATH is already configured."));
        }
        process.exit(0);
      });
    } catch (error) {
      spinner.fail(chalk.red("Setup failed."));
      process.exit(1);
    }
  }

  private showHelp() {
    console.log(
      chalk.cyan(`
  ____  ____  ____  __  __  ____  ____  ____  ____ 
 (  _ \\(  _ \\(  _ \\(  \\/  )(  _ \\(_  _)(  __)(  _ \\
  ) __/ )   / )(_) ))    (  ) __/  )(   ) _)  )   /
 (__)  (__\\_)(____/(_/\\/\\_)(__)   (__) (____)(__\\_) v${SYSTEM.VERSION}
    `)
    );
    console.log(
      Boxen(
        chalk.white(
          `🚀 The Ultimate Codebase Digester + AI Ops\nMade with ❤️  by ${chalk.bold(
            "Rilaptra"
          )}`
        ),
        {
          padding: 1,
          margin: { top: 0, bottom: 1 },
          borderStyle: "round",
          borderColor: "cyan",
          textAlignment: "center",
        }
      )
    );

    const helpTable = new Table({
      head: [chalk.cyan("Command"), chalk.cyan("Description")],
      colWidths: [25, 45],
      style: { head: [], border: [] },
    });
    helpTable.push(
      ["setup", 'Install "digest" command to system'],
      ["set-key <KEY>", "Set Google Gemini API Key"],
      ["set-model", "Select AI Model from API"],
      ["commit", "AI Auto-Commit, Changelog & Tag"],
      [".", "Scan current directory"],
      ["config", "Generate config file"]
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

    const shouldWrite = await Utils.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write File? ${chalk.dim("(Y/n)")} `
    );
    if (!shouldWrite) {
      console.log(chalk.dim("Cancelled."));
      process.exit(0);
    }

    await this.writeOutput(stats, repoName);
  }

  private displayReport(stats: ScanStats) {
    console.log("");
    const table = new Table({
      head: [chalk.white("Metric"), chalk.white("Value")],
      colWidths: [20, 35],
    });
    table.push(
      [chalk.cyan("Total Files"), stats.files.length],
      [chalk.yellow("Context Size"), Utils.formatSize(stats.totalSize)],
      [chalk.magenta("Est. Tokens"), Utils.estimateTokens(stats.totalSize)],
      [
        chalk.red("Skipped"),
        `${stats.skippedCount} files (${Utils.formatSize(stats.skippedSize)})`,
      ]
    );
    console.log(table.toString());

    if (Object.keys(stats.extStats).length > 0) {
      console.log(`\n${chalk.dim("Distribution:")}`);
      Object.entries(stats.extStats)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 5)
        .forEach(([ext, d]) => {
          const pct = ((d.size / stats.totalSize) * 100).toFixed(1);
          console.log(
            `  ${chalk.cyan(ext.padEnd(8))} : ${d.count
              .toString()
              .padEnd(5)} files | ${chalk.yellow(
              Utils.formatSize(d.size)
            )} (${pct}%)`
          );
        });
    }
    console.log("");
  }

  private async writeOutput(stats: ScanStats, repoName: string) {
    const outPath = join(SYSTEM.OUT_DIR, `DIGEST_${repoName}_${Date.now()}.md`);
    if (!existsSync(SYSTEM.OUT_DIR)) {
      await Bun.write(join(SYSTEM.OUT_DIR, ".keep"), "");
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });
    writer.write(
      `# ${repoName}\n\n## Tree\n\`\`\`\n${stats.tree.join(
        "\n"
      )}\n\`\`\`\n\n## Code\n`
    );

    const writeSpin = ora("Writing...").start();
    let done = 0;
    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);
      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${await Bun.file(
              f.path
            ).text()}\n\`\`\`\n`;
          } catch {
            return "";
          }
        })
      );
      for (const c of contents) writer.write(c);
      done += chunk.length;
      writeSpin.text = `Writing ${Math.round(
        (done / stats.files.length) * 100
      )}%`;
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

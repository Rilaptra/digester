/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: <explanation: Biome> */
import { basename, dirname, join, parse, relative, resolve } from "node:path"; // Import basename explicit
import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { DependencyTracer } from "../core/DependencyTracer.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type { ScanStats } from "../types/index.js";
import { promptFileExplorer } from "../utils/explorer.js";
import * as Utils from "../utils/index.js";
import { generateLog } from "../utils/logger.js";

export class TraceCommand extends BaseCommand {
  public name = "trace";
  public description = "Digest dependency graph starting from an entry point";
  public aliases = ["deps", "graph"];

  public async execute(args: string[]): Promise<void> {
    const cwd = process.cwd();
    let entryFile = args[0];

    this.createBox("🕸️ DEPENDENCY TRACER");

    // 1. Interactive File Explorer if no arg provided
    if (!entryFile) {
      this.info("Select the entry point file (e.g., src/index.ts):");
      const selected = await promptFileExplorer(cwd, cwd); // Start browsing from CWD

      if (!selected) {
        this.warn("Operation cancelled.");
        return;
      }
      entryFile = selected;
    } else {
      entryFile = Utils.resolvePath(entryFile) || "";
    }

    if (!entryFile || !(await Bun.file(entryFile).exists())) {
      this.error("❌ Invalid entry file.");
      return;
    }

    // 🔥 FIX: DETECT REAL PROJECT ROOT
    // Jangan pake CWD digester, tapi cari root dari file target
    const targetRoot = await this.findProjectRoot(entryFile);

    // Relative path buat display
    const relEntry = relative(targetRoot, entryFile);

    this.success(`Context Root: ${chalk.dim(targetRoot)}`);
    this.success(`Target File: ${chalk.bold(relEntry)}`);

    // 2. Trace Dependencies
    const spinner = this.spinner("Tracing imports recursively...");
    const filesToDigest = new Set<string>();

    try {
      // Pass 'targetRoot' supaya security check di Tracer valid untuk project seberang
      const tracedFiles = await DependencyTracer.trace(entryFile, targetRoot);
      tracedFiles.forEach((f) => {
        filesToDigest.add(f);
      });
      spinner.succeed(
        `Trace complete! Found ${filesToDigest.size} related files.`,
      );
    } catch (e) {
      spinner.fail(`Trace failed: ${(e as Error).message}`);
      return;
    }

    // 3. Collect Data & Digest
    // Pass targetRoot biar path relative di output Markdown bener
    await this.processFiles(filesToDigest, targetRoot, relEntry);
  }

  /**
   * 🔥 Helper baru: Cari package.json ke atas untuk nentuin root project target
   */
  private async findProjectRoot(filePath: string): Promise<string> {
    let current = dirname(resolve(filePath));
    const { root } = parse(current);

    // Loop naik ke atas sampai ketemu package.json atau mentok drive root (C:\)
    while (current !== root) {
      if (await Bun.file(join(current, "package.json")).exists()) {
        return current;
      }
      current = dirname(current);
    }

    // Fallback: Kalau gak nemu package.json, pake folder tempat file itu berada
    return dirname(resolve(filePath));
  }

  // --- Regex Cleaner ---
  private stripAnsi(str: string): string {
    return str.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      "",
    );
  }

  private async processFiles(
    filePaths: Set<string>,
    root: string,
    entryLabel: string,
  ) {
    const config = await ConfigManager.load(root);
    const stats: ScanStats = {
      files: [],
      tree: [],
      skippedCount: 0,
      skippedSize: 0,
      totalSize: 0,
      extStats: {},
      duration: "0",
    };

    const start = performance.now();
    const processSpinner = this.spinner("Reading & digesting files...");

    const sortedPaths = Array.from(filePaths).sort();

    for (const fullPath of sortedPaths) {
      const relPath = relative(root, fullPath); // Path relative terhadap targetRoot
      const filename = fullPath.split("/").pop() || "";

      if (config.ignoredPatterns.has(filename)) continue;

      try {
        const { stat } = await import("node:fs/promises");
        const s = await stat(fullPath);

        if (s.size > config.maxFileSize) {
          stats.skippedCount++;
          stats.skippedSize += s.size;
          continue;
        }

        const ext = filename.includes(".")
          ? `.${filename.split(".").pop()}`
          : "";

        stats.files.push({
          path: fullPath,
          relPath: relPath,
          size: s.size,
          ext: ext.replace(".", "") || "txt",
        });

        stats.totalSize += s.size;

        if (!stats.extStats[ext]) stats.extStats[ext] = { count: 0, size: 0 };
        stats.extStats[ext].count++;
        stats.extStats[ext].size += s.size;

        const isEntry = fullPath.endsWith(entryLabel) || relPath === entryLabel;
        const icon = isEntry ? "🎯" : "🔗";
        stats.tree.push(`${icon} ${chalk.green(relPath)}`);
      } catch {}
    }

    stats.duration = (performance.now() - start).toFixed(0);
    processSpinner.succeed("Digest ready.");

    this.displayReport(stats);
    await this.writeOutput(stats, entryLabel);
  }

  private displayReport(stats: ScanStats) {
    generateLog({ type: "info", raw: true }, "");
    const table = new Table({
      head: [chalk.white("Metric"), chalk.white("Value")],
      colWidths: [20, 35],
    });
    table.push(
      [chalk.cyan("Traced Files"), stats.files.length],
      [chalk.yellow("Context Size"), Utils.formatSize(stats.totalSize)],
      [chalk.magenta("Est. Tokens"), Utils.estimateTokens(stats.totalSize)],
    );
    generateLog({ type: "info", raw: true }, table.toString());
  }

  private async writeOutput(stats: ScanStats, entryLabel: string) {
    const safeLabel = entryLabel.replace(/[/\\]/g, "-");
    const outPath = join(
      SYSTEM.OUT_DIR,
      `DIGEST_TRACE_${safeLabel}_${Date.now()}.md`,
    );

    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    // Clean ANSI codes from tree before writing
    const cleanTree = stats.tree.map((line) => this.stripAnsi(line)).join("\n");

    const writer = Bun.file(outPath).writer();

    writer.write(
      `# Dependency Trace: ${entryLabel}\n\n` +
        `> **Method:** Recursive Import Trace\n` +
        `> **Entry Point:** \`${entryLabel}\`\n\n` +
        `## Graph Structure\n\`\`\`\n${cleanTree}\n\`\`\`\n\n`,
    );

    const writeSpin = this.spinner("Writing digest...");

    for (const f of stats.files) {
      try {
        const text = await Bun.file(f.path).text();
        writer.write(
          `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${text}\n\`\`\`\n`,
        );
      } catch {}
    }

    writer.end();
    // Gunakan import 'basename' langsung, bukan via Utils
    writeSpin.succeed(chalk.green(`Saved: generated/${basename(outPath)}`));

    Utils.openFile(SYSTEM.OUT_DIR);
  }
}

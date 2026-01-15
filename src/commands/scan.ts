import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { Scanner } from "../core/Scanner.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type { ScanStats } from "../types/index.js";
import * as UtilFunctions from "../utils/index.js";
import { generateLog } from "../utils/logger.js";

export class ScanCommand extends BaseCommand {
  public name = "scan";
  public description = "Scan directory and generate digest";
  public aliases = [".", "run"];

  public async execute(args: string[]): Promise<void> {
    let targetPaths: string[] = [];

    if (args.length > 0) {
      targetPaths = args;
    } else {
      const mode = await this.promptSelectV2(
        chalk.cyan("🎯  Select Scan Mode:"),
        [
          "Full Scan (Current Directory)",
          "Custom Paths (Specific Folders/Files)",
        ]
      );

      if (mode.startsWith("Custom")) {
        const input = await UtilFunctions.promptText(
          chalk.yellow(
            "👉 Enter paths (space separated, e.g. 'src/utils tests'): "
          )
        );
        targetPaths = input
          .split(" ")
          .map((p) => p.trim())
          .filter((p) => p.length > 0);

        if (targetPaths.length === 0) {
          this.warn("No paths entered. Defaulting to current directory.");
          targetPaths = ["."];
        }
      } else {
        targetPaths = ["."];
      }
    }

    await this.scanTargets(targetPaths);
  }

  // 🔥 NEW HELPER: Detect Project Name from Git or Folder
  private async getProjectName(root: string): Promise<string> {
    try {
      // 1. Coba baca dari .git/config (Paling Akurat)
      const gitConfigPath = join(root, ".git", "config");
      const gitConfigFile = Bun.file(gitConfigPath);

      if (await gitConfigFile.exists()) {
        const text = await gitConfigFile.text();
        // Regex buat ambil nama repo dari URL (e.g. github.com/user/my-repo.git -> my-repo)
        const match = text.match(/url\s*=\s*.*\/([^/]+?)(\.git)?\s*$/m);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {
      // Ignore error, fallback ke folder name
    }

    // 2. Fallback: Nama folder tempat command dijalankan
    return basename(root);
  }

  private async scanTargets(paths: string[]) {
    const aggregatedStats: ScanStats = {
      files: [],
      tree: [],
      skippedCount: 0,
      skippedSize: 0,
      totalSize: 0,
      extStats: {},
      duration: "0",
    };

    const startTime = performance.now();
    const projectRoot = process.cwd();

    // 🔥 Panggil Helper di sini
    const projectName = await this.getProjectName(projectRoot);
    const rootConfig = await ConfigManager.load(projectRoot);

    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    this.dim(`   Project: ${chalk.bold(projectName)}`); // Kasih feedback ke user

    for (const path of paths) {
      const targetDir = UtilFunctions.resolvePath(path);
      if (!targetDir) {
        this.warn(`⚠️  Skipping invalid path: "${path}"`);
        continue;
      }

      // Hitung path relative untuk Tree & Header File
      const dirNameRelativeToRoot = relative(projectRoot, targetDir);

      const spinner = this.spinner(
        `Scanning ${chalk.bold(dirNameRelativeToRoot || ".")}...`
      );

      const stats = await Scanner.run(targetDir, rootConfig);
      spinner.succeed(
        `Scanned ${dirNameRelativeToRoot || "Root"} (${
          stats.files.length
        } files)`
      );

      // 🛠️ Update RelPath agar sesuai Project Root
      stats.files.forEach((f) => {
        f.relPath = relative(projectRoot, f.path);
      });
      aggregatedStats.files.push(...stats.files);

      // 🛠️ Tree Visual Enhancement
      if (dirNameRelativeToRoot && dirNameRelativeToRoot !== "") {
        aggregatedStats.tree.push(
          chalk.bold.blue(`📂 ${dirNameRelativeToRoot}/`)
        );
      }
      aggregatedStats.tree.push(...stats.tree);

      // Merge Counters
      aggregatedStats.skippedCount += stats.skippedCount;
      aggregatedStats.skippedSize += stats.skippedSize;
      aggregatedStats.totalSize += stats.totalSize;

      for (const [ext, data] of Object.entries(stats.extStats)) {
        if (!aggregatedStats.extStats[ext]) {
          aggregatedStats.extStats[ext] = { count: 0, size: 0 };
        }
        aggregatedStats.extStats[ext].count += data.count;
        aggregatedStats.extStats[ext].size += data.size;
      }
    }

    aggregatedStats.duration = (performance.now() - startTime).toFixed(0);

    if (aggregatedStats.files.length === 0) {
      this.error("❌ No valid files found in selected targets.");
      return;
    }

    this.displayReport(aggregatedStats);

    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write Digest File? ${chalk.dim(
        "(Y/n)"
      )} `
    );

    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    // 🔥 Pake projectName yang udah kita dapet di awal
    await this.writeOutput(aggregatedStats, projectName);
  }

  // Display report ga berubah
  private displayReport(stats: ScanStats) {
    // (Kode sama persis seperti sebelumnya)
    generateLog({ type: "info", raw: true }, "");
    const table = new Table({
      head: [chalk.white("Metric"), chalk.white("Value")],
      colWidths: [20, 35],
    });
    table.push(
      [chalk.cyan("Total Files"), stats.files.length],
      [chalk.yellow("Context Size"), UtilFunctions.formatSize(stats.totalSize)],
      [
        chalk.magenta("Est. Tokens"),
        UtilFunctions.estimateTokens(stats.totalSize),
      ],
      [
        chalk.red("Skipped"),
        `${stats.skippedCount} files (${UtilFunctions.formatSize(
          stats.skippedSize
        )})`,
      ],
      [chalk.dim("Duration"), `${stats.duration}ms`]
    );
    generateLog({ type: "info", raw: true }, table.toString());

    if (Object.keys(stats.extStats).length > 0) {
      generateLog(
        { type: "info", raw: true },
        `\n${chalk.dim("Distribution:")}`
      );
      Object.entries(stats.extStats)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 5)
        .forEach(([ext, d]) => {
          const pct = ((d.size / stats.totalSize) * 100).toFixed(1);
          generateLog(
            { type: "info", raw: true },
            `  ${chalk.cyan(ext.padEnd(8))} : ${d.count
              .toString()
              .padEnd(5)} files | ${chalk.yellow(
              UtilFunctions.formatSize(d.size)
            )} (${pct}%)`
          );
        });
    }
    generateLog({ type: "info", raw: true }, "");
  }

  private async writeOutput(stats: ScanStats, projectName: string) {
    // 🔥 Nama file output sekarang konsisten: DIGEST_NamaRepo_Timestamp
    const outPath = join(
      SYSTEM.OUT_DIR,
      `DIGEST_${projectName}_${Date.now()}.md`
    );

    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    // 🔥 Judul Markdown juga ngikutin nama repo
    writer.write(
      `# Project Digest: ${projectName}\n\n## Structure\n\`\`\`\n${stats.tree.join(
        "\n"
      )}\n\`\`\`\n\n## Code Content\n`
    );

    const writeSpin = this.spinner("Writing to disk...");
    let done = 0;

    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);

      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            const text = await Bun.file(f.path).text();
            return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${text}\n\`\`\`\n`;
          } catch {
            return `\n// --- ${f.relPath} (Error Reading File) ---\n`;
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

    this.dim("   📂 Opening output directory...");
    UtilFunctions.smartOpenFolder(SYSTEM.OUT_DIR);
  }
}

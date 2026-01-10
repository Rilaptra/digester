// --- src/commands/scan.ts ---
import { existsSync } from "node:fs";
import { basename, join } from "node:path";
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

    // 1. Cek argumen dari CLI dulu
    if (args.length > 0) {
      targetPaths = args;
    } else {
      // 2. Kalau kosong, masuk mode Interaktif
      const mode = await this.promptSelect(
        chalk.cyan("🎯  Select Scan Mode:"),
        [
          "Full Scan (Current Directory)",
          "Custom Paths (Specific Folders/Files)",
        ],
      );

      if (mode.startsWith("Custom")) {
        // Minta input manual dipisah spasi
        const input = await UtilFunctions.promptText(
          chalk.yellow(
            "👉 Enter paths (space separated, e.g. 'src/utils tests'): ",
          ),
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

  private async scanTargets(paths: string[]) {
    // Container buat gabungin hasil scan dari banyak folder
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
    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    
    // Load config sekali aja dari root (asumsi monorepo/single project)
    const rootConfig = await ConfigManager.load(process.cwd());

    // Loop setiap path yang diminta user
    for (const path of paths) {
      const targetDir = UtilFunctions.resolvePath(path);
      if (!targetDir) {
        this.warn(`⚠️  Skipping invalid path: "${path}"`);
        continue;
      }

      // Spinner aesthetic
      const spinner = this.spinner(`Scanning ${chalk.bold(path)}...`);
      
      // Jalanin Scanner yang udah ada
      const stats = await Scanner.run(targetDir, rootConfig);
      
      spinner.succeed(`Scanned ${path} (${stats.files.length} files)`);

      // Merge Logic (High Performance)
      aggregatedStats.files.push(...stats.files);
      aggregatedStats.tree.push(...stats.tree); // Tree digabung aja
      aggregatedStats.skippedCount += stats.skippedCount;
      aggregatedStats.skippedSize += stats.skippedSize;
      aggregatedStats.totalSize += stats.totalSize;

      // Merge Extension Stats
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

    // Tampilkan Report
    this.displayReport(aggregatedStats);

    // Konfirmasi Tulis File
    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write Digest File? ${chalk.dim("(Y/n)")} `,
    );
    
    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    // Nama file output dinamis
    const label = paths.length === 1 && paths[0] !== "." 
      ? basename(paths[0]) 
      : "Multi_Scope";
      
    await this.writeOutput(aggregatedStats, label);
  }

  private displayReport(stats: ScanStats) {
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
          stats.skippedSize,
        )})`,
      ],
      [chalk.dim("Duration"), `${stats.duration}ms`],
    );
    generateLog({ type: "info", raw: true }, table.toString());

    if (Object.keys(stats.extStats).length > 0) {
      generateLog(
        { type: "info", raw: true },
        `\n${chalk.dim("Distribution:")}`,
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
              UtilFunctions.formatSize(d.size),
            )} (${pct}%)`,
          );
        });
    }
    generateLog({ type: "info", raw: true }, "");
  }

  private async writeOutput(stats: ScanStats, label: string) {
    const outPath = join(SYSTEM.OUT_DIR, `DIGEST_${label}_${Date.now()}.md`);
    
    // Pastikan folder output ada (Lazy create)
    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    // Write Header & Tree
    writer.write(
      `# Project Digest: ${label}\n\n## Structure\n\`\`\`\n${stats.tree.join(
        "\n",
      )}\n\`\`\`\n\n## Code Content\n`,
    );

    const writeSpin = this.spinner("Writing to disk...");
    let done = 0;
    
    // Chunk processing buat hemat memori (Batching)
    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);
      
      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            // Baca file on-demand biar RAM ga meledak nyimpen string gede
            const text = await Bun.file(f.path).text();
            return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${text}\n\`\`\`\n`;
          } catch {
            return `\n// --- ${f.relPath} (Error Reading File) ---\n`;
          }
        }),
      );
      
      for (const c of contents) writer.write(c);
      
      done += chunk.length;
      writeSpin.text = `Writing ${Math.round(
        (done / stats.files.length) * 100,
      )}%`;
    }
    
    writer.end();
    writeSpin.succeed(chalk.green(`Saved: ${basename(outPath)}`));

    this.dim("   📂 Opening output directory...");
    UtilFunctions.openFile(SYSTEM.OUT_DIR);
  }
}
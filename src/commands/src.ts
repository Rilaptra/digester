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

export class SrcCommand extends BaseCommand {
  public name = "source";
  public description = "digest the source code of this tool";
  public aliases: string[] = ["src", "srccode", "self"];

  async execute() {
    const srcPath = SYSTEM.ROOT_DIR;

    if (!existsSync(srcPath)) {
      this.error("❌ Project root not found.");
      return;
    }

    await this.scanTargets([srcPath]);
  }

  private async getProjectName(root: string): Promise<string> {
    try {
      const gitConfigPath = join(root, ".git", "config");
      const gitConfigFile = Bun.file(gitConfigPath);

      if (await gitConfigFile.exists()) {
        const text = await gitConfigFile.text();
        const match = text.match(/url\s*=\s*.*\/([^/]+?)(\.git)?\s*$/m);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {}
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
    const projectRoot = SYSTEM.ROOT_DIR;
    const projectName = await this.getProjectName(projectRoot);
    const rootConfig = await ConfigManager.load(projectRoot);

    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    this.dim(`   Project: ${chalk.bold(projectName)} (Self-Digest)`);

    for (const path of paths) {
      const targetDir = UtilFunctions.resolvePath(path);
      if (!targetDir) {
        this.warn(`⚠️  Skipping invalid path: "${path}"`);
        continue;
      }

      const dirNameRelativeToRoot = relative(projectRoot, targetDir);
      const spinner = this.spinner(
        `Scanning ${chalk.bold(dirNameRelativeToRoot || ".")}...`,
      );

      const stats = await Scanner.run(targetDir, rootConfig);
      spinner.succeed(
        `Scanned ${dirNameRelativeToRoot || "Root"} (${stats.files.length} files)`,
      );

      stats.files.forEach((f) => {
        f.relPath = relative(projectRoot, f.path);
      });
      aggregatedStats.files.push(...stats.files);

      if (dirNameRelativeToRoot && dirNameRelativeToRoot !== "") {
        aggregatedStats.tree.push(
          chalk.bold.blue(`📂 ${dirNameRelativeToRoot}/`),
        );
      }
      aggregatedStats.tree.push(...stats.tree);

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
      this.error("❌ No files found in 'src' directory.");
      return;
    }

    this.displayReport(aggregatedStats);

    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write Digest File? ${chalk.dim("(Y/n)")} `,
    );

    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    await this.writeOutput(aggregatedStats, projectName);
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

  private async writeOutput(stats: ScanStats, projectName: string) {
    const outPath = join(
      SYSTEM.OUT_DIR,
      `DIGEST_${projectName}_SRC_${Date.now()}.md`,
    );

    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    writer.write(
      `# Project Source Digest: ${projectName}\n\n## Structure\n\`\`\`\n${stats.tree.join(
        "\n",
      )}\n\`\`\`\n\n## Code Content\n`,
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

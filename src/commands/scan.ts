import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { Scanner } from "../core/Scanner.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type { ScanStats } from "../types/index.js";
import * as UtilFunctions from "../utils/index.js"; // Importing as namespace to be safe or use named imports if possible.
import { generateLog } from "../utils/logger.js";

export class ScanCommand extends BaseCommand {
  public name = "scan"; // We might handle '.' in loader or alias
  public description = "Scan a directory and generate a digest";
  public aliases = [".", "run"];

  public async execute(args: string[]): Promise<void> {
    // args[0] might be the path if the user typed `digest scan <path>`
    // or if they typed `digest .`, args might be empty if we parse it right?
    // In AppController, it passed `this.command` as path if default.
    // Here, if invoked as `digest scan path`, args[0] is path.
    // If invoked as `digest .`, alias match `scan`, args[0] is empty?
    // We'll treat the first argument as path, or default to current.

    // However, the previous logic was: `digest <path>` -> `scanDirectory(path)`
    // So if I type `digest .` -> command is `.`.
    // If I type `digest src` -> command is `src`.
    // The CommandLoader needs to handle the "default command" fallback if no command matches.
    // I will implement "ScanCommand" to handle the scanning logic.
    // The AppController will invoke this command if no other command matches.

    const path = args.length > 0 ? args[0] : ".";
    await this.scanDirectory(path);
  }

  private async scanDirectory(path: string) {
    const targetDir = UtilFunctions.resolvePath(path);
    if (!targetDir) {
      this.error(`Directory not found -> "${path}"`);
      process.exit(1);
    }

    const repoName = basename(targetDir);
    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));

    const spinner = this.spinner(`Analyzing ${chalk.bold(repoName)}...`);
    const config = await ConfigManager.load(targetDir);
    const statsCode = await Scanner.run(targetDir, config); // Scanner.run might return ScanStats?
    // Checking AppController: const stats = await Scanner.run(targetDir, config);
    // Assuming Scanner.run returns ScanStats.

    spinner.stop();

    const stats = statsCode as unknown as ScanStats; // Cast if needed or trust TS

    if (stats.files.length === 0) {
      this.error(`No valid files found in ${targetDir}`);
      process.exit(1);
    }

    this.displayReport(stats);

    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write File? ${chalk.dim("(Y/n)")} `,
    );
    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    await this.writeOutput(stats, repoName);
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

  private async writeOutput(stats: ScanStats, repoName: string) {
    const outPath = join(SYSTEM.OUT_DIR, `DIGEST_${repoName}_${Date.now()}.md`);
    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });
    writer.write(
      `# ${repoName}\n\n## Tree\n\`\`\`\n${stats.tree.join(
        "\n",
      )}\n\`\`\`\n\n## Code\n`,
    );

    const writeSpin = this.spinner("Writing...");
    let done = 0;
    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);
      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${await Bun.file(
              f.path,
            ).text()}\n\`\`\`\n`;
          } catch {
            return "";
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

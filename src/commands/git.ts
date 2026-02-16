import { rm } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { Scanner } from "../core/Scanner.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type { ScanStats } from "../types/index.js";
import * as Utils from "../utils/index.js"; // Pastikan utils udah direfactor sesuai saran sebelumnya
import { generateLog } from "../utils/logger.js";

/**
 * Command to clone, scan, and digest a remote Git repository.
 * Automatically cleans up the temporary directory after processing.
 */
export class GitCommand extends BaseCommand {
  public name = "git";
  public description = "Clone and digest a remote git repository";
  public aliases = ["clone", "remote"];

  public async execute(args: string[]): Promise<void> {
    // 1. Parse Arguments to get URL
    const repoUrl = this.resolveRepoUrl(args);
    if (!repoUrl) {
      this.error("Usage: digest git <url> OR digest git <user>/<repo>");
      this.info("Example: digest git https://github.com/bunland/bun");
      this.info("Example: digest git rizlaptra/digester");
      return;
    }

    // 2. Setup Temp Directory
    // Pake timestamp biar unique & gak collision kalau run multiple instances
    const repoName = this.extractRepoName(repoUrl);
    const tempDir = join(
      process.cwd(),
      `.digest-temp-${repoName}-${Date.now()}`,
    );

    this.createBox(`🌐 REMOTE DIGEST: ${repoName}`);

    const cloneSpinner = this.spinner("Cloning repository (depth=1)...");

    try {
      // Gunakan Bun.spawn langsung disini biar control penuh,
      // ATAU pake GitManager.exec kalau mau reusable (tapi ini case specific temp dir)
      const proc = Bun.spawn(
        ["git", "clone", "--depth", "1", repoUrl, tempDir],
        { stdio: ["ignore", "pipe", "pipe"] }, // Capture stderr
      );

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        const stderr = await new Response(proc.stderr).text();
        // 🔥 STOP SPINNER DENGAN PESAN ERROR
        if (stderr.includes("not found")) {
          throw new Error("Repository not found (404). Check URL.");
        }
        if (
          stderr.includes("Permission denied") ||
          stderr.includes("Authentication failed")
        ) {
          throw new Error("Access denied. Private repo requires auth.");
        }
        throw new Error(stderr.trim());
      }

      cloneSpinner.succeed("Repository cloned successfully.");

      // 4. Perform Scan
      await this.scanRepo(tempDir, repoName);
    } catch (e) {
      // 🔥 PASTIKAN FAIL DIPANGGIL
      cloneSpinner.fail("Clone failed.");
      this.error((e as Error).message);
    } finally {
      // 5. Cleanup (Wajib!)
      // Pake try-catch di finally biar kalau cleanup gagal, app gak crash bodoh
      try {
        if (
          (await Bun.file(join(tempDir, "package.json")).exists()) ||
          (await Bun.file(join(tempDir, ".git")).exists())
        ) {
          // Safety check: Make sure we are deleting the temp dir we created
          const cleanSpinner = this.spinner("Cleaning up temporary files...");
          await rm(tempDir, { recursive: true, force: true });
          cleanSpinner.succeed("Cleanup complete.");
        }
      } catch (cleanupError) {
        this.warn(`Failed to cleanup temp dir: ${tempDir}`);
        this.dim((cleanupError as Error).message);
      }
    }
  }

  /**
   * Smart URL Resolver.
   * Handles:
   * - "user/repo" -> "https://github.com/user/repo.git"
   * - "https://..." -> "https://..."
   * - "git@..." -> "git@..."
   */
  private resolveRepoUrl(args: string[]): string | undefined {
    if (args.length === 0) return undefined;

    const raw = args[0];

    // Case 1: Standard URL or SSH
    if (
      raw.startsWith("http") ||
      raw.startsWith("git@") ||
      raw.startsWith("ssh://")
    ) {
      return raw;
    }

    // Case 2: "user repo" (space separated)
    if (args.length === 2) {
      return `https://github.com/${args[0]}/${args[1]}.git`;
    }

    // Case 3: "user/repo" shorthand (GitHub default)
    if (raw.split("/").length === 2) {
      return `https://github.com/${raw}.git`;
    }

    return raw; // Fallback try
  }

  private extractRepoName(url: string): string {
    // Remove .git suffix and extract last part
    const clean = url.replace(/\.git$/, "");
    const parts = clean.split("/");
    return parts[parts.length - 1] || "repository";
  }

  /**
   * Core scanning logic (Reused from ScanCommand logic mostly)
   */
  private async scanRepo(targetDir: string, repoName: string) {
    const start = performance.now();

    // Load config from the CLONED repo (if they have prompter.config.json)
    // Or fallback to default.
    const config = await ConfigManager.load(targetDir);

    const spinner = this.spinner("Analyzing codebase structure...");

    // Execute Core Scanner
    const stats = await Scanner.run(targetDir, config);

    // Fix Relative Paths
    // Scanner.run returns relative to targetDir.
    // Since targetDir is temp, the relative paths are actually correct (e.g. "src/index.ts")
    // We don't need complex adjustments here.

    spinner.succeed(`Scanned ${stats.files.length} files.`);

    // Display Stats
    this.displayReport(stats);

    // Write Output
    await this.writeOutput(stats, repoName);

    const duration = (performance.now() - start).toFixed(0);
    this.dim(`Total process time: ${duration}ms`);
  }

  private displayReport(stats: ScanStats) {
    generateLog({ type: "info", raw: true }, "");
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
      ],
    );
    generateLog({ type: "info", raw: true }, table.toString());
  }

  private async writeOutput(stats: ScanStats, repoName: string) {
    const outFileName = `DIGEST_REMOTE_${repoName}_${Date.now()}.md`;
    const outPath = join(SYSTEM.OUT_DIR, outFileName);

    // Ensure out dir exists
    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    // Write Header
    writer.write(
      `# Remote Repository Digest: ${repoName}\n\n` +
        `> Generated by Prompter CLI\n` +
        `> Date: ${new Date().toISOString()}\n\n` +
        `## Structure\n\`\`\`\n${stats.tree.join("\n")}\n\`\`\`\n\n` +
        `## Code Content\n`,
    );

    const writeSpin = this.spinner("Generating Markdown Digest...");
    let done = 0;

    // Write Files
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
    writeSpin.succeed(chalk.green(`Digest saved: generated/${outFileName}`));

    // Optional: Ask to open
    Utils.openFile(SYSTEM.OUT_DIR);
  }
}

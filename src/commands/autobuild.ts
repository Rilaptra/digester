import { watch } from "node:fs";
import { relative } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { generateLog } from "../utils/logger.js";

export class AutoBuildCommand extends BaseCommand {
  public name = "autobuild";
  public description =
    "Watch for file changes and rebuild automatically (Dev Mode)";
  public aliases = ["dev", "watch", "live"];

  private isBuilding = false;
  private timer: Timer | null = null;
  private readonly DEBOUNCE_MS = 600; // Delay dikit biar gak spam build pas typing save

  public async execute(_args: string[]): Promise<void> {
    console.clear();
    this.createBox("⚡ AUTO-BUILD WATCHER", "Dev Mode");

    this.log(chalk.dim(`   Watching: ${SYSTEM.ROOT_DIR}/src`));
    this.log(chalk.dim("   [r] Force Rebuild  |  [q] Quit\n"));

    // 1. Initial Build
    await this.triggerBuild("Initial Start");

    // 2. Setup Watcher (Native Node/Bun FS Watcher)
    // Kita watch ROOT_DIR tapi filter manual biar performa tetap enteng
    // daripada watch recursive src doang kadang ada config di root yg ngaruh.
    const watcher = watch(
      SYSTEM.ROOT_DIR,
      { recursive: true },
      (event, filename) => {
        if (!filename) return;

        // Filter Junk Files
        if (
          filename.includes("node_modules") ||
          filename.includes(".git") ||
          filename.includes("dist") ||
          filename.includes("generated") ||
          filename.includes("bin")
        ) {
          return;
        }

        // Filter Only TypeScript / Config changes
        if (!filename.endsWith(".ts") && !filename.endsWith("json")) {
          return;
        }

        // Debounce Mechanism
        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(() => {
          const relPath = relative(SYSTEM.ROOT_DIR, filename);
          // Visual feedback file mana yang berubah
          this.triggerBuild(`${event}: ${relPath}`);
        }, this.DEBOUNCE_MS);
      }
    );

    // 3. Setup Keyboard Shortcuts (Interactive)
    const { stdin } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    stdin.on("data", (key: string) => {
      // Ctrl+C or q to quit
      if (key === "\u0003" || key.toLowerCase() === "q") {
        watcher.close();
        generateLog({ type: "info", raw: true }, "\n👋 Exiting Watch Mode.");
        process.exit(0);
      }

      // r to rebuild
      if (key.toLowerCase() === "r") {
        if (!this.isBuilding) {
          this.triggerBuild("Manual Trigger");
        }
      }
    });

    // Keep process alive
    await new Promise(() => {});
  }

  private async triggerBuild(reason: string) {
    if (this.isBuilding) return;
    this.isBuilding = true;

    // Clear console slightly to focus on new build (optional, style preference)
    // console.clear();
    // this.createBox("⚡ AUTO-BUILD WATCHER", "Dev Mode");

    generateLog({ type: "info", raw: true }, chalk.dim("─".repeat(50)));
    generateLog({ type: "warn" }, `Change detected: ${chalk.yellow(reason)}`);

    const spinner = this.spinner("Compiling...");
    const start = performance.now();

    try {
      // Spawn Child Process untuk menjalankan build
      // Kita pakai 'bun run build' yang sudah didefinisikan di package.json
      const proc = Bun.spawn(["bun", "run", "build"], {
        cwd: SYSTEM.ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"], // Capture output
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();

      const duration = (performance.now() - start).toFixed(0);

      if (exitCode === 0) {
        spinner.succeed(chalk.green(`Build success in ${duration}ms`));
        generateLog({ type: "success" }, chalk.bold("✨ Ready for changes..."));
      } else {
        spinner.fail(chalk.red("Build failed!"));
        generateLog({ type: "error", raw: true }, chalk.red(stderr));
      }
    } catch (error) {
      spinner.fail("Spawn error");
      this.error((error as Error).message);
    } finally {
      this.isBuilding = false;
    }
  }
}

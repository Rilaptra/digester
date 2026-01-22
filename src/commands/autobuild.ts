import { watch } from "node:fs";
import { relative } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { generateLog } from "../utils/logger.js";

export class AutoBuildCommand extends BaseCommand {
  public name = "autobuild";
  public description =
    "Watch for file changes and rebuild automatically with Audio/Visual feedback";
  public aliases = ["dev", "watch", "live"];

  private isBuilding = false;
  private timer: Timer | null = null;
  private readonly DEBOUNCE_MS = 600;

  public async execute(_args: string[]): Promise<void> {
    console.clear();
    this.createBox("⚡ AUTO-BUILD WATCHER", "Dev Mode");
    this.setTitle("⏳ Digester: Standing By");

    this.log(chalk.dim(`   Watching: ${SYSTEM.ROOT_DIR}/src`));
    this.log(chalk.dim("   [r] Force Rebuild  |  [q] Quit\n"));

    // 1. Initial Build
    await this.triggerBuild("Initial Start");

    // 2. Setup Watcher
    const watcher = watch(
      SYSTEM.ROOT_DIR,
      { recursive: true },
      (event, filename) => {
        if (!filename) return;

        // Filter Junk
        if (
          filename.includes("node_modules") ||
          filename.includes(".git") ||
          filename.includes("dist") ||
          filename.includes("generated") ||
          filename.includes("src\\commands\\index.ts") ||
          filename.includes("bin")
        ) {
          return;
        }

        // Filter Source Code
        if (!filename.endsWith(".ts") && !filename.endsWith("json")) {
          return;
        }

        if (this.timer) clearTimeout(this.timer);

        this.timer = setTimeout(() => {
          const relPath = relative(SYSTEM.ROOT_DIR, filename);
          this.triggerBuild(`${event}: ${relPath}`);
        }, this.DEBOUNCE_MS);
      },
    );

    // 3. Setup Keyboard
    const { stdin } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    stdin.on("data", (key: string) => {
      if (key === "\u0003" || key.toLowerCase() === "q") {
        watcher.close();
        this.setTitle("Digester: Stopped");
        generateLog({ type: "info", raw: true }, "\n👋 Exiting Watch Mode.");
        process.exit(0);
      }
      if (key.toLowerCase() === "r") {
        if (!this.isBuilding) {
          this.triggerBuild("Manual Trigger");
        }
      }
    });

    // Keep alive
    await new Promise(() => {});
  }

  private async triggerBuild(reason: string) {
    if (this.isBuilding) return;
    this.isBuilding = true;
    this.setTitle("🔨 Digester: Building...");

    generateLog({ type: "info", raw: true }, chalk.dim("─".repeat(50)));
    generateLog({ type: "warn" }, `Change detected: ${chalk.yellow(reason)}`);

    const spinner = this.spinner("Compiling...");
    const start = performance.now();

    try {
      const proc = Bun.spawn(["bun", "run", "build"], {
        cwd: SYSTEM.ROOT_DIR,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const exitCode = await proc.exited;
      const stderr = await new Response(proc.stderr).text();
      const duration = (performance.now() - start).toFixed(0);

      if (exitCode === 0) {
        spinner.succeed(chalk.green(`Build success in ${duration}ms`));
        generateLog({ type: "success" }, chalk.bold("✨ Ready for changes..."));
        this.setTitle("✅ Digester: Ready");
        this.playSound(true);
      } else {
        spinner.fail(chalk.red("Build failed!"));
        generateLog({ type: "error", raw: true }, chalk.red(stderr));
        this.setTitle("❌ Digester: FAILED");
        this.playSound(false);
      }
    } catch (error) {
      spinner.fail("Spawn error");
      this.error((error as Error).message);
    } finally {
      this.isBuilding = false;
    }
  }

  // --- UTILS: UX ENHANCEMENT ---

  /**
   * Mengubah judul terminal window.
   * Sangat berguna pas lagi alt-tab biar tau status tanpa buka window.
   */
  private setTitle(title: string) {
    process.stdout.write(`\x1b]0;${title}\x07`);
  }

  /**
   * Mainkan suara sistem tanpa dependensi eksternal (pake native OS commands).
   * Efisien RAM karena spawn process-nya fire-and-forget.
   */
  private playSound(success: boolean) {
    // Windows: Pake PowerShell .NET SoundPlayer (Built-in)
    if (process.platform === "win32") {
      const soundType = success
        ? "[System.Media.SystemSounds]::Asterisk" // Ting!
        : "[System.Media.SystemSounds]::Hand"; // Error sound

      Bun.spawn(["powershell", "-c", `${soundType}.Play()`], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      return;
    }

    // MacOS
    if (process.platform === "darwin") {
      const soundFile = success ? "Glass" : "Basso";
      Bun.spawn(["afplay", `/System/Library/Sounds/${soundFile}.aiff`], {
        stdio: ["ignore", "ignore", "ignore"],
      });
      return;
    }

    // Linux / Fallback: ASCII Bell
    if (!success) process.stdout.write("\x07");
  }
}

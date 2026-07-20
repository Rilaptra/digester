import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { generateLog } from "../utils/logger.js";

export class SetupCommand extends BaseCommand {
  public name = "setup";
  public description = "Install 'digest' command to system (Windows only)";
  public aliases = [];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🛠️  PROMPTER SETUP WIZARD");

    if (process.platform !== "win32") {
      this.warn("Automatic setup is optimized for Windows.");
      return;
    }

    const spinner = this.spinner("Configuring environment...");
    try {
      const fs = await import("node:fs/promises");
      if (!(await Bun.file(SYSTEM.BIN_DIR).exists())) {
        await fs.mkdir(SYSTEM.BIN_DIR, { recursive: true });
      }

      const batPath = join(SYSTEM.BIN_DIR, "digest.bat");
      const distFile = join(SYSTEM.ROOT_DIR, "dist", "index.js");

      // Ensure dist exists (since it's gitignored now)
      if (!(await Bun.file(distFile).exists())) {
        spinner.text = "Compiling source code...";
        try {
          const buildProc = Bun.spawn(["bun", "run", "build"], {
            cwd: SYSTEM.ROOT_DIR,
            stderr: "pipe",
          });
          await buildProc.exited;
        } catch (_e) {
          // Ignore build errors, try to proceed or let it fail later?
          // Better to just warn or keep going, the user might fix it later.
        }
      }

      const entryFile = distFile;
      const batContent = `@echo off\nbun "${entryFile}" %*`;
      await Bun.write(batPath, batContent);
      spinner.succeed(`Created shim: ${chalk.green("bin/digest.bat")}`);
      // console.log(SYSTEM);
      // return;
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
      const proc = Bun.spawn(["powershell", "-Command", psCommand]);
      const text = await new Response(proc.stdout).text();

      if (text.trim() === "UPDATED") {
        spinner.succeed(chalk.green("Added ./bin to User PATH!"));
        generateLog(
          { type: "warn", raw: true },
          chalk.bgRed.white.bold("\n ⚠️  RESTART REQUIRED ") +
            " Please restart terminal.",
        );
      } else {
        spinner.succeed(chalk.green("PATH is already configured."));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Setup failed: ${(error as Error).message}`));
      process.exit(1);
    }
  }
}

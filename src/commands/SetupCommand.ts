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
      // We assume run from source with bun for now
      const entryFile = join(SYSTEM.ROOT_DIR, "src", "index.ts");
      const batContent = `@echo off\nbun "${entryFile}" %*`;
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

import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { GitManager } from "../managers/GitManager.js";
import { generateLog } from "../utils/logger.js";

export class UpdateCommand extends BaseCommand {
  public name = "update";
  public description = "Self-update Digester to the latest version";
  public aliases = ["upgrade", "self-update"];

  public async execute(_args: string[]): Promise<void> {
    const targetDir = SYSTEM.ROOT_DIR;
    this.createBox("🚀 DIGESTER SELF-UPDATE SYSTEM");

    // 1. Check if running from a Git Repo
    if (!GitManager.isRepo(targetDir)) {
      this.error("❌ Digester is not installed via Git. Cannot auto-update.");
      this.dim("   Try cloning the repo directly: git clone https://github.com/Rilaptra/digester.git");
      return;
    }

    const spinner = this.spinner("Checking for updates...");

    try {
      // 2. Fetch Origin
      const fetchProc = Bun.spawn(["git", "fetch", "origin"], { cwd: targetDir });
      await fetchProc.exited;

      // 3. Compare Local vs Remote HEAD
      const localHash = await this.getHash(targetDir, "HEAD");
      const remoteHash = await this.getHash(targetDir, "origin/main"); // Asumsi branch utama 'main'

      if (!localHash || !remoteHash) {
        spinner.fail("Failed to retrieve git hashes.");
        return;
      }

      if (localHash === remoteHash) {
        spinner.succeed(chalk.green("You are already on the latest version! ✨"));
        this.dim(`   Current Hash: ${localHash.substring(0, 7)}`);
        return;
      }

      spinner.text = `Update found! ${chalk.dim(localHash.substring(0, 7))} ➜ ${chalk.green(remoteHash.substring(0, 7))}`;
      spinner.stop();

      const confirm = await this.promptYesNo(
        `${chalk.bold("🔥 New version available!")} Update now?`
      );

      if (!confirm) {
        this.dim("Update cancelled.");
        return;
      }

      // 4. Perform Update
      const updateSpinner = this.spinner("Pulling latest changes...");
      
      // GIT PULL
      const pullProc = Bun.spawn(["git", "pull", "origin", "main"], { 
        cwd: targetDir,
        stderr: "pipe" 
      });
      const pullExit = await pullProc.exited;
      if (pullExit !== 0) {
         const err = await new Response(pullProc.stderr).text();
         throw new Error(`Git pull failed: ${err}`);
      }
      updateSpinner.text = "Installing dependencies (bun install)...";

      // BUN INSTALL
      const installProc = Bun.spawn(["bun", "install"], { cwd: targetDir });
      await installProc.exited;

      updateSpinner.text = "Re-building binary (bun run build)...";

      // BUN BUILD
      const buildProc = Bun.spawn(["bun", "run", "build"], { cwd: targetDir });
      await buildProc.exited;

      updateSpinner.succeed("✅ Digester successfully updated!");
      
      generateLog(
        { type: "success", raw: true },
        `${chalk.bgGreen.black("\n RESTART REQUIRED ")} Please restart your terminal/command.`
      );

    } catch (e) {
      spinner.fail(chalk.red(`Update failed: ${(e as Error).message}`));
    }
  }

  private async getHash(dir: string, ref: string): Promise<string> {
    try {
      const proc = Bun.spawn(["git", "rev-parse", ref], { cwd: dir });
      const text = await new Response(proc.stdout).text();
      return text.trim();
    } catch {
      return "";
    }
  }
}
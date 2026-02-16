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

    // 1. Check if Repo
    if (!GitManager.isRepo(targetDir)) {
      this.error("❌ Digester is not installed via Git. Cannot auto-update.");
      return;
    }

    // 2. 🔥 CHECK DIRTY STATE (Biar ga error conflict pas git pull)
    // Ini krusial banget buat UX
    if (await GitManager.isDirty(targetDir)) {
      this.warn("⚠️  You have uncommitted local changes.");
      this.dim("   Updating now might cause merge conflicts.");
      const force = await this.promptYesNo(
        "Discard local changes and update?",
        false,
      );

      if (!force) {
        this.error("Update aborted. Please commit or stash your changes.");
        return;
      }
      // Kalau user nekat, kita hard reset (Dangerous but effective for tool update)
      const resetSpin = this.spinner("Resetting local changes...");
      try {
        Bun.spawnSync(["git", "reset", "--hard", "HEAD"], { cwd: targetDir });
        resetSpin.succeed("Local changes discarded.");
      } catch {
        resetSpin.fail("Failed to reset changes.");
        return;
      }
    }

    const spinner = this.spinner("Checking for updates...");

    try {
      // 3. Fetch (Bisa fail kalau ga ada internet)
      await GitManager.fetch(targetDir);

      const localHash = await GitManager.getHash(targetDir, "HEAD");
      const remoteHash = await GitManager.getHash(targetDir, "origin/main");

      if (!localHash || !remoteHash) {
        throw new Error("Could not retrieve version hashes.");
      }

      if (localHash === remoteHash) {
        spinner.succeed(
          chalk.green("You are already on the latest version! ✨"),
        );
        return;
      }

      spinner.stop(); // Stop dulu buat prompt

      generateLog(
        { type: "info" },
        `Update available: ${chalk.dim(localHash.slice(0, 7))} ➜ ${chalk.green(remoteHash.slice(0, 7))}`,
      );

      const confirm = await this.promptYesNo(
        `${chalk.bold("🔥 Install Update?")} This will rebuild the binary.`,
      );
      if (!confirm) {
        this.dim("Cancelled.");
        return;
      }

      // 4. Perform Update Sequence
      const updateSpinner = this.spinner("🚀 Pulling latest changes...");

      // Git Pull (Pake manager yang baru, bakal throw error kalo conflict/network fail)
      await GitManager.pull(targetDir);

      updateSpinner.text = "📦 Installing dependencies...";
      const installProc = Bun.spawn(["bun", "install"], { cwd: targetDir });
      if ((await installProc.exited) !== 0)
        throw new Error("Bun install failed");

      updateSpinner.text = "🏗️  Re-building binary...";
      const buildProc = Bun.spawn(["bun", "run", "build"], { cwd: targetDir });
      if ((await buildProc.exited) !== 0) throw new Error("Build failed");

      updateSpinner.succeed("✅ Digester successfully updated!");

      generateLog(
        { type: "success", raw: true },
        `${chalk.bgGreen.black("\n RESTART REQUIRED ")} Please restart your terminal.`,
      );
    } catch (e) {
      // 🔥 INI FIX UTAMANYA: Catch block yang proper
      // Apapun errornya (Network, Git, Bun), spinner BERHENTI disini.
      spinner.fail(chalk.red("Update Failed!"));

      const msg = (e as Error).message;
      if (msg.includes("Network")) {
        this.error("🌐 Network Error: Check your internet connection.");
      } else if (msg.includes("Conflict")) {
        this.error("⚔️  Merge Conflict detected during update.");
      } else {
        this.error(`❌ Details: ${msg}`);
      }
    }
  }
}

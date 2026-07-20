import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { AIManager } from "../managers/AIManager.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import { GitManager } from "../managers/GitManager.js";
import { generateLog } from "../utils/logger.js";

export class CheckCommand extends BaseCommand {
  public name = "check";
  public description = "Scan for potential secret leaks in staged changes";
  public aliases = ["ck"];

  public async execute(args: string[]): Promise<void> {
    const isThis = args[0] === "this";
    const targetDir = isThis ? process.cwd() : SYSTEM.ROOT_DIR;
    const modeLabel = isThis ? "CURRENT DIR" : "SELF-UPDATE";

    this.createBox(`🔍 SECRET SCANNER (${modeLabel})`);

    if (!GitManager.isRepo(targetDir)) {
      this.error("❌ Not a Git repository.");
      process.exit(1);
    }

    const auth = await ConfigManager.getAuth();
    if (!auth.apiKey) {
      this.error("API Key missing. Run 'digest set-key <KEY>' first.");
      process.exit(1);
    }

    const spinner = this.spinner("Staging changes and calculating diff...");
    const diff = await GitManager.prepareAndGetDiff(targetDir);

    if (!diff || diff.trim().length === 0) {
      spinner.fail(chalk.yellow("No staged changes to scan."));
      return;
    }

    spinner.text = "AI is scanning for secrets...";

    try {
      const result = await AIManager.generateCommitDetails(diff, auth);
      spinner.stop();

      if (result.checkResult) {
        if (result.checkResult.isSafe) {
          this.success("✅ No secrets detected. Changes look safe to commit.");
        } else {
          generateLog(
            { type: "warn", raw: true },
            chalk.bgRed.white.bold("\n 🛡️  SECURITY WARNING "),
          );
          generateLog(
            { type: "warn", raw: true },
            `   ${chalk.red(result.checkResult.message)}\n`,
          );
          this.warn("Please review your changes before committing.");
        }
      } else {
        this.warn("⚠️  AI did not provide a safety check result.");
      }
    } catch (e) {
      spinner.fail(chalk.red(`Scan failed: ${(e as Error).message}`));
    }
  }
}

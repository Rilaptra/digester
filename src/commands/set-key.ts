import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { ConfigManager } from "../managers/ConfigManager.js";

export class SetKeyCommand extends BaseCommand {
  public name = "set-key";
  public description = "Set Google Gemini API Key";
  public aliases = ["auth"];

  public async execute(args: string[]): Promise<void> {
    let key = args[0];
    if (!key) {
      key = await this.promptText(
        chalk.cyan("🔑 Enter Google Gemini API Key: "),
      );
    }

    if (!key) {
      this.warn("No API Key provided. Operation cancelled.");
      return;
    }

    await ConfigManager.saveAuth({ apiKey: key });
    this.success(`API Key saved securely in global config.`);
    this.dim(`   Location: ${SYSTEM.AUTH_FILE}`);
  }
}

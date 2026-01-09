import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { ConfigManager } from "../managers/ConfigManager.js";

export class SetKeyCommand extends BaseCommand {
  public name = "set-key";
  public description = "Set Google Gemini API Key";
  public aliases = ["auth"];

  public async execute(args: string[]): Promise<void> {
    const key = args[0];
    if (!key) {
      this.error("Usage: digest set-key <YOUR_GOOGLE_API_KEY>");
      process.exit(1);
    }
    await ConfigManager.saveAuth({ apiKey: key });
    this.success(`API Key saved securely in global config.`);
    this.dim(`   Location: ${SYSTEM.AUTH_FILE}`);
  }
}

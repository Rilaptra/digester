import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { AIManager } from "../managers/AIManager.js";
import { ConfigManager } from "../managers/ConfigManager.js";

export class SetModelCommand extends BaseCommand {
  public name = "set-model";
  public description = "Select AI Model from API";
  public aliases = ["model"];

  public async execute(_args: string[]): Promise<void> {
    const auth = await ConfigManager.getAuth();
    if (!auth.apiKey) {
      this.error("Please set API Key first using 'digest set-key'");
      process.exit(1);
    }

    const spinner = this.spinner("Fetching available Gemini models...");
    try {
      const models = await AIManager.fetchModels(auth.apiKey);
      spinner.stop();

      if (models.length === 0) throw new Error("No models found.");

      const selection = await this.promptSelect(
        chalk.cyan("\n🤖 Choose AI Model:"),
        models,
      );
      await ConfigManager.saveAuth({ model: selection });
      this.success(`Model set to: ${chalk.bold(selection)}`);
    } catch (e) {
      spinner.fail(chalk.red(`Failed to list models: ${(e as Error).message}`));
    }
  }
}

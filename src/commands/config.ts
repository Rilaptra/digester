import path from "node:path";
import { DEFAULT_CONFIG } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import * as Utils from "../utils/index.js";

export class ConfigCommand extends BaseCommand {
  public name = "config";
  public description = "Generate a default configuration file";
  public aliases = ["init"];

  public async execute(_args: string[]): Promise<void> {
    const cfgPath = path.join(process.cwd(), "prompter.config.json");
    await Bun.write(cfgPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
    this.success(`Config generated at: ${cfgPath}`);
    Utils.openFile(cfgPath);
  }
}

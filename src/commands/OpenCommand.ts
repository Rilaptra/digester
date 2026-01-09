import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import * as Utils from "../utils/index.js";

export class OpenCommand extends BaseCommand {
  public name = "open";
  public description = "Open source code directory";
  public aliases = [];

  public async execute(_args: string[]): Promise<void> {
    this.log(chalk.cyan("📂 Opening source code..."));
    Utils.openFile(SYSTEM.ROOT_DIR);
  }
}

// src/core/AppController.ts
import chalk from "chalk";
import * as Commands from "../commands/index.js";
import { SystemManager } from "../managers/SystemManager.js"; // 👈 New Location
import { generateLog } from "../utils/logger.js";
import { CommandLoader } from "./CommandLoader.js";

export class AppController {
  private loader: CommandLoader;

  constructor() {
    this.loader = new CommandLoader();
  }

  public async run() {
    SystemManager.init();

    console.clear();

    // Load commands
    this.loader.registerCommands(Object.values(Commands));

    const args = Bun.argv.slice(2);
    const commandName = args[0] || ".";

    let command = this.loader.getCommand(commandName);
    let commandArgs = args.slice(1);

    if (!command) {
      if (commandName.startsWith("-")) {
        generateLog(
          { type: "error" },
          chalk.red(`Unknown option: ${commandName}`),
        );
        process.exit(1);
      }
      // Fallback to scan
      command = this.loader.getCommand("scan");
      commandArgs = [commandName, ...commandArgs];
    }

    if (command) {
      try {
        await command.execute(commandArgs, { loader: this.loader });
      } catch (error) {
        generateLog(
          { type: "error" },
          chalk.red("Command execution failed:"),
          (error as Error).message,
        );
        process.exit(1);
      } finally {
        await SystemManager.notify();
      }
    } else {
      generateLog(
        { type: "error" },
        chalk.red("Critical Error: Command not found."),
      );
      process.exit(1);
    }
  }
}

import { join } from "node:path";
import chalk from "chalk";
import { generateLog } from "../utils/logger.js";
import { CommandLoader } from "./CommandLoader.js";

export class AppController {
  private loader: CommandLoader;

  constructor() {
    this.loader = new CommandLoader();
  }

  public async run() {
    console.clear();

    // Load commands
    const commandsDir = join(import.meta.dir, "..", "commands");
    await this.loader.load(commandsDir);

    const args = Bun.argv.slice(2);
    const commandName = args[0] || ".";
    // If commandName is ".", treat as scan.

    // Handle specific flags that might be passed as first arg but are aliases
    // e.g. -h -> help command should handle it via alias?
    // The loader has getCommand(name) which checks aliases.

    let command = this.loader.getCommand(commandName);
    let commandArgs = args.slice(1);

    // Fallback: if not found, assume it is a path to scan
    if (!command) {
      if (commandName.startsWith("-")) {
        // Could be a flag for help?
        // If -h is passed, getCommand("-h") should find HelpCommand if alias is set.
        // CommandLoader aliases map: alias -> name.
        // If "-h" found, it returns HelpCommand.
        // If invalid flag, maybe error?
        generateLog(
          { type: "error" },
          chalk.red(`Unknown option: ${commandName}`),
        );
        process.exit(1);
      }

      // Assume "scan" command for the given path
      command = this.loader.getCommand("scan");
      // The scan command expects the path as the first argument in its execute(args)
      // So we pass [commandName, ...rest]
      commandArgs = [commandName, ...commandArgs];
    } else {
      // If command was found (e.g. "config"), commandArgs are the rest.
    }

    if (command) {
      try {
        await command.execute(commandArgs, { loader: this.loader }); // Pass loader for help command
      } catch (error) {
        generateLog(
          { type: "error" },
          chalk.red("Command execution failed:"),
          (error as Error).message,
        );
        process.exit(1);
      }
    } else {
      // Should not happen if scan is loaded
      generateLog(
        { type: "error" },
        chalk.red("Critical Error: 'scan' command not found."),
      );
      process.exit(1);
    }
  }
}

import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import type { CommandLoader } from "../core/CommandLoader.js";

export class HelpCommand extends BaseCommand {
  public name = "help";
  public description = "Show help information";
  public aliases = ["h", "-h", "--help"];

  public async execute(
    _args: string[],
    context: { loader: CommandLoader },
  ): Promise<void> {
    const loader = context.loader;

    this.log(
      chalk.cyan(`
  ____  ____  ____  __  __  ____  ____  ____  ____ 
 (  _ \\(  _ \\(  _ \\(  \\/  )(  _ \\(_  _)(  __)(  _ \\
  ) __/ )   / )(_) ))    (  ) __/  )(   ) _)  )   /
 (__)  (__\\_)(____/(_/\\/\\_)(__)   (__) (____)(__\\_) v${SYSTEM.VERSION}
    `),
    );

    this.createBox(
      chalk.white(
        `🚀 The Ultimate Codebase Digester + AI Ops\nMade by ${chalk.bold(
          "Rilaptra",
        )}`,
      ),
      "Prompter CLI",
    );

    const table = new Table({
      head: [
        chalk.cyan("Command"),
        chalk.cyan("Description"),
        chalk.cyan("Aliases"),
      ],
      colWidths: [20, 40, 20],
      style: { head: [], border: [] },
    });

    if (loader) {
      const commands: BaseCommand[] = loader.getAllCommands();
      commands.forEach((cmd) => {
        table.push([
          chalk.bold(cmd.name),
          cmd.description,
          chalk.dim(cmd.aliases.join(", ")),
        ]);
      });
      // Add manual entry for 'scan' if it's treated specially as default,
      // but ideally we make ScanCommand have name '.' or 'scan'

      // If we haven't migrated everything, prompt user might be confused.
      // But assuming we will migrate all.
    } else {
      table.push(["...", "Commands not loaded."]);
    }

    this.log(table.toString());
  }
}

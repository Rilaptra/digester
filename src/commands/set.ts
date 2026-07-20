import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import type { CommandLoader } from "../core/CommandLoader.js";

export class SetCommand extends BaseCommand {
  public name = "set";
  public description =
    "Configure global settings like AI models, API keys, and other preferences.";
  public aliases = ["config-set", "settings", "s"];

  public async execute(
    _args: string[],
    context: { loader: CommandLoader },
  ): Promise<void> {
    // 1. Get all available commands
    const allCommands = context.loader.getAllCommands();

    // 2. Filter for "set-*" commands, excluding the main "set" command itself
    const setCommands = allCommands.filter(
      (cmd) =>
        (cmd.name.startsWith("set-") || cmd.aliases.includes("set")) &&
        cmd.name !== "set",
    );

    if (setCommands.length === 0) {
      this.warn("No configuration commands found.");
      return;
    }

    // 3. Format options for display (e.g., "Set Key", "Set Model")
    const options = setCommands.map((cmd) => {
      // transform "set-model" -> "Set Model"
      return cmd.name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    });

    // 4. Prompt user
    const selection = await this.promptSelectV2(
      chalk.cyan("⚙  Configuration Menu"),
      options,
      { columns: 2, allowCustom: false },
    );

    // 5. specific behavior for "Other" if allowCustom was true (not currently used but good for future)
    if (selection === "Other") {
      this.info("No other options available yet.");
      return;
    }

    // 6. Find the original command based on the selection
    const selectedCommand = setCommands.find((cmd) => {
      const formattedName = cmd.name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
      return formattedName === selection;
    });

    if (!selectedCommand) {
      this.error(`Could not find command for selection: ${selection}`);
      return;
    }

    // 7. Execute the sub-command
    // We pass empty args [] because set-key/set-model might prompt if no args are passed,
    // or we might want to handle args forwarding in the future.
    // For now, assuming interactive mode if called via menu.
    await selectedCommand.execute([], context);
  }
}

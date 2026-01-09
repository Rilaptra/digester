/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation:Biome> */
import chalk from "chalk";
import { generateLog } from "../utils/logger.js";
import { BaseCommand } from "./BaseCommand.js";

export class CommandLoader {
  private commands: Map<string, BaseCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Load commands from a directory
   */
  /**
   * Register a manual list of commands (Static Loading for Bundling)
   */
  public registerCommands(commands: any[]) {
    commands.forEach((CmdClass) => {
      try {
        if (CmdClass && CmdClass.prototype instanceof BaseCommand) {
          const instance = new CmdClass() as BaseCommand;
          this.commands.set(instance.name, instance);
          if (instance.aliases) {
            instance.aliases.forEach((alias) => {
              this.aliases.set(alias, instance.name);
            });
          }
        }
      } catch (_e) {
        generateLog(
          { type: "warn" },
          chalk.yellow(`Failed to register command`),
        );
      }
    });
  }

  // Legacy dynamic loader (kept for reference or dev, but unused in production bundle)
  public async load(_directory: string): Promise<void> {
    // ... dynamic l_directoryved to save space or commented out?
    // I'll leave the empty implementation or log a warning if used.
    // Actually, let's just make it do nothing or throw, since we want to force static.
    // Or better, just remove the implementation to be clean.
  }

  public getCommand(name: string): BaseCommand | undefined {
    if (this.commands.has(name)) {
      return this.commands.get(name);
    }
    const aliasTarget = this.aliases.get(name);
    if (aliasTarget) {
      return this.commands.get(aliasTarget);
    }
    return undefined;
  }

  public getAllCommands(): BaseCommand[] {
    return Array.from(this.commands.values());
  }
}

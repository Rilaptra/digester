import { readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { generateLog } from "../utils/logger.js";
import { BaseCommand } from "./BaseCommand.js";

export class CommandLoader {
  private commands: Map<string, BaseCommand> = new Map();
  private aliases: Map<string, string> = new Map();

  /**
   * Load commands from a directory
   */
  public async load(directory: string): Promise<void> {
    try {
      const files = await readdir(directory);
      for (const file of files) {
        if (
          (file.endsWith(".ts") || file.endsWith(".js")) &&
          !file.endsWith(".d.ts")
        ) {
          await this.registerCommand(join(directory, file));
        }
      }
    } catch (error) {
      generateLog(
        { type: "error" },
        chalk.red(`Failed to load commands from ${directory}:`),
        error,
      );
    }
  }

  private async registerCommand(filePath: string) {
    try {
      // Dynamic import
      const module = await import(filePath);
      // Assume default export or named export matching file name?
      // Let's iterate exports to find one extending BaseCommand
      for (const key in module) {
        const ExportedClass = module[key];
        if (
          typeof ExportedClass === "function" &&
          ExportedClass.prototype instanceof BaseCommand
        ) {
          const instance = new ExportedClass() as BaseCommand;
          this.commands.set(instance.name, instance);
          if (instance.aliases) {
            instance.aliases.forEach((alias) => {
              this.aliases.set(alias, instance.name);
            });
          }
          // console.log(chalk.gray(`Loaded command: ${instance.name}`));
          return; // Only load one command per file for now
        }
      }
    } catch (error) {
      generateLog(
        { type: "warn" },
        chalk.yellow(`Could not load command from ${filePath}:`),
        error,
      );
    }
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

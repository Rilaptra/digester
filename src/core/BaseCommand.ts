import Boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import ora, { type Ora } from "ora";
import * as Utils from "../utils/index.js";
import { generateLog } from "../utils/logger.js";
import type { CommandLoader } from "./CommandLoader.js";

/**
 * Abstract Base Class for all CLI commands.
 * Provides shared utilities for logging, UI, and prompting.
 * All commands MUST extend this class.
 *
 * @abstract
 * @class BaseCommand
 */
export abstract class BaseCommand {
  /**
   * The unique name of the command.
   * Used by the CommandLoader to route arguments.
   * @type {string}
   */
  public abstract name: string;

  /**
   * A brief description of what the command does.
   * Displayed in the help menu.
   * @type {string}
   */
  public abstract description: string;

  /**
   * List of alternative names for the command.
   * @type {string[]}
   * @default []
   */
  public aliases: string[] = [];

  /**
   * Main execution method. Must be implemented by subclasses.
   *
   * @param {string[]} args - Arguments passed after the command name.
   * @param {Object} [context] - Optional execution context.
   * @param {CommandLoader} [context.loader] - Reference to the command loader instance.
   * @returns {Promise<void>} A promise that resolves when the command finishes execution.
   * @abstract
   */
  public abstract execute(
    args: string[],
    context?: { loader: CommandLoader }
  ): Promise<void>;

  /**
   * Logs an informational message to the console.
   * Uses standard logging context.
   *
   * @param {string} msg - The message to log.
   * @protected
   */
  protected log(msg: string): void {
    generateLog({ type: "info", raw: true }, msg);
  }

  /**
   * Logs an error message.
   *
   * @param {string} msg - The error description.
   * @protected
   */
  protected error(msg: string): void {
    generateLog({ type: "error" }, msg);
  }

  /**
   * Logs a success message.
   *
   * @param {string} msg - The success description.
   * @protected
   */
  protected success(msg: string): void {
    generateLog({ type: "success" }, msg);
  }

  /**
   * Logs a warning message.
   *
   * @param {string} msg - The warning description.
   * @protected
   */
  protected warn(msg: string): void {
    generateLog({ type: "warn" }, msg);
  }

  /**
   * Logs a generic info message (with context).
   *
   * @param {string} msg - The info message.
   * @protected
   */
  protected info(msg: string): void {
    generateLog({ type: "info" }, msg);
  }

  /**
   * Logs a dimmed (gray) message, usually for secondary details.
   * Skips context prefix for cleaner output.
   *
   * @param {string} msg - The text to display.
   * @protected
   */
  protected dim(msg: string): void {
    generateLog({ type: "info", noContext: true }, chalk.gray(msg));
  }

  /**
   * Starts a terminal spinner.
   *
   * @param {string} text - The text to display alongside the spinner.
   * @returns {Ora} The spinner instance (use .succeed(), .fail(), or .stop() later).
   * @protected
   */
  protected spinner(text: string): Ora {
    return ora(text).start();
  }

  /**
   * Creates a bordered box with optional title.
   * Good for section headers or important announcements.
   *
   * @param {string} text - The content inside the box.
   * @param {string} [title] - Optional title displayed on the border.
   * @protected
   */
  protected createBox(text: string, title?: string): void {
    generateLog(
      { type: "info", raw: true },
      Boxen(text, {
        padding: 1,
        borderStyle: "round",
        title: title ? chalk.cyan(title) : undefined,
        borderColor: "cyan",
      })
    );
  }

  /**
   * Creates a CLI Table instance configured with project defaults.
   *
   * @param {string[]} headers - Array of header strings.
   * @returns {Table.Table} The configured table instance.
   * @protected
   */
  protected createTable(headers: string[]): Table.Table {
    return new Table({
      head: headers.map((h) => chalk.cyan(h)),
      style: { head: [], border: [] },
    });
  }

  /**
   * Prompts the user with a Yes/No question.
   *
   * @param {string} question - The question to ask.
   * @returns {Promise<boolean>} True for Yes, False for No.
   * @protected
   */
  protected async promptYesNo(question: string): Promise<boolean> {
    return Utils.promptYesNo(question);
  }

  /**
   * Prompts the user to select multiple options via comma-separated indices.
   *
   * @param {string} question - The question to ask.
   * @param {string[]} options - List of choices.
   * @returns {Promise<string[]>} List of selected options.
   * @protected
   */
  protected async promptMultiSelect(
    question: string,
    options: string[]
  ): Promise<string[]> {
    return Utils.promptMultiSelect(question, options);
  }

  /**
   * Prompts the user using the advanced Grid/Compact selection menu.
   *
   * @param {string} question - The question to ask.
   * @param {string[]} options - List of choices.
   * @param {Object} [config] - Configuration for columns and custom input.
   * @returns {Promise<string>} The selected option.
   * @protected
   */
  protected async promptSelectV2(
    question: string,
    options: string[],
    config?: { allowCustom?: boolean; columns?: number }
  ): Promise<string> {
    return Utils.promptSelectV2(question, options, config);
  }
}

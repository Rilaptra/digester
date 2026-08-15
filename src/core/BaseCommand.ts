import Boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import ora, { type Ora } from "ora";
import * as Utils from "../utils/index.js";
import { generateLog } from "../utils/logger.js";
import {
  CommandPalette,
  type PaletteItem,
} from "../utils/tui/CommandPalette.js";
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
    context?: { loader: CommandLoader },
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
      }),
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
   * Memulai Progress Bar
   */
  protected progress(config: Utils.ProgressBarConfig): Utils.ProgressBar {
    return new Utils.ProgressBar(config);
  }

  /**
   * Menampilkan Push Notification / Toast
   */
  protected async notify(config: Utils.ToastConfig | string): Promise<void> {
    await Utils.Notification.show(config);
  }

  /**
   * Prompts the user with a Yes/No question.
   *
   * @param {string} question - The question to ask.
   * @returns {Promise<boolean>} True for Yes, False for No.
   * @protected
   */
  /**
   * Prompts the user with a Yes/No question.
   *
   * @param {string} question - The question to ask.
   * @param {boolean} [initialValue=true] - Initial selection (default: false/No).
   * @returns {Promise<boolean>} True for Yes, False for No.
   * @protected
   */
  protected async promptYesNo(
    question: string,
    initialValue = true,
  ): Promise<boolean> {
    return new Utils.Confirm({ title: question, initialValue }).run();
  }

  /**
   * Prompts the user for a standard text input.
   *
   * @param {string} question - The text to display.
   * @param {string} [placeholder] - Optional placeholder text.
   * @param {string} [initialValue] - Optional initial value.
   * @param {boolean} [password] - If true, mask the input.
   * @returns {Promise<string>} The user's input.
   * @protected
   */
  protected async promptText(
    question: string,
    placeholder?: string,
    initialValue?: string,
    password?: boolean,
  ): Promise<string> {
    return new Utils.TextPrompt({
      title: question,
      placeholder,
      initialValue,
      password,
    }).run();
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
    options: string[],
  ): Promise<string[]> {
    // Mapping string[] -> MultiSelectOption[]
    const multiSelect = new Utils.MultiSelect<string>().title(question);

    options.forEach((opt) => {
      multiSelect.add(opt, opt);
    });

    return multiSelect.run();
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
    config?: { allowCustom?: boolean; columns?: number },
  ): Promise<string> {
    const select = new Utils.Select<string>()
      .title(question)
      .columns(config?.columns || 1);

    options.forEach((opt) => {
      select.add(opt, opt);
    });

    if (config?.allowCustom) {
      select.add("Other...", "Other...");
    }

    const result = await select.run();

    if (config?.allowCustom && result === "Other...") {
      return this.promptText(chalk.yellow("   👉 Enter value: "));
    }

    return result;
  }

  protected async promptPalette(
    title: string,
    items: PaletteItem[],
  ): Promise<string | null> {
    return new CommandPalette(title, items).run();
  }

  /**
   * Prompt dengan autocomplete + path-aware filtering.
   *
   * 🔥 Ngetik "src/" → filter hanya children src
   * 🔥 Ngetik "src/co" → filter hanya src/commands, src/core
   * 🔥 Ngetik ".ts" → filter ext
   */
  protected async promptAutoComplete(
    message: string,
    suggestions: string[],
    options?: {
      initialValue?: string;
      limit?: number;
      separator?: string | RegExp;
    },
  ): Promise<string> {
    const ac = new Utils.AutoComplete({
      title: message,
      selectMode: true,
      suggest: (token: string) => {
        if (!token || token.length === 0) {
          return suggestions.slice(0, options?.limit || 20);
        }

        const lower = token.toLowerCase();

        // ═══════════════════════════════════════
        // 🔥 PATH-AWARE FILTERING
        // ═══════════════════════════════════════

        // Kalau token mengandung "/" → user lagi navigate sub-folder
        if (lower.includes("/")) {
          const lastSlash = lower.lastIndexOf("/");
          const prefix = lower.slice(0, lastSlash + 1); // e.g., "src/"
          const searchTerm = lower.slice(lastSlash + 1); // e.g., "co"

          // Filter: harus mulai dari prefix
          const children = suggestions.filter((s) =>
            s.toLowerCase().startsWith(prefix),
          );

          if (searchTerm.length === 0) {
            // Ngetik "src/" → tampilkan semua children
            return children.slice(0, options?.limit || 20);
          }

          // Ngetik "src/co" → tampilkan children yang match "co"
          const startsWith = children.filter((s) => {
            const afterPrefix = s.slice(prefix.length);
            return afterPrefix.toLowerCase().startsWith(searchTerm);
          });

          const includes = children.filter((s) => {
            const afterPrefix = s.slice(prefix.length);
            return (
              !afterPrefix.toLowerCase().startsWith(searchTerm) &&
              afterPrefix.toLowerCase().includes(searchTerm)
            );
          });

          return [...startsWith, ...includes].slice(0, options?.limit || 20);
        }

        // ═══════════════════════════════════════
        // 🔥 EXT-AWARE FILTERING
        // ═══════════════════════════════════════
        if (lower.startsWith(".") && lower.length <= 5) {
          const extMatches = suggestions.filter((s) =>
            s.toLowerCase().startsWith(lower),
          );
          if (extMatches.length > 0) {
            return extMatches.slice(0, options?.limit || 20);
          }
        }

        // ═══════════════════════════════════════
        // 🔥 DEFAULT: startsWith + includes
        // ═══════════════════════════════════════
        const startsWith = suggestions.filter((s) =>
          s.toLowerCase().startsWith(lower),
        );

        const includes = suggestions.filter(
          (s) =>
            !s.toLowerCase().startsWith(lower) &&
            s.toLowerCase().includes(lower),
        );

        return [...startsWith, ...includes].slice(0, options?.limit || 20);
      },
      initialValue: options?.initialValue,
      limit: options?.limit ?? 10,
      separator: options?.separator ?? " ", // 🔥 FIX: Gunakan Nullish Coalescing
    });

    return ac.run();
  }
}

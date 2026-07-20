import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

/**
 * Configuration options for the Confirm prompt.
 */
export interface ConfirmConfig {
  /** The question or title to display. */
  title: string;
  /** The initial boolean value (true for Yes, false for No). Default is false (safety). */
  initialValue?: boolean;
}

/**
 * An interactive Yes/No confirmation prompt.
 * Uses strict boolean values and provides clear visual feedback.
 */
export class Confirm {
  private config: ConfirmConfig;
  private value: boolean;

  /**
   * Creates a new Confirm prompt instance.
   * @param {ConfirmConfig} config - Initial configuration.
   */
  constructor(config: ConfirmConfig) {
    this.config = config;
    this.value = config.initialValue ?? false; // Default false (Safety first)
  }

  /**
   * Starts the interactive prompt and waits for user input.
   *
   * @returns {Promise<boolean>} Resolves to true if confirmed (Yes), false otherwise (No).
   */
  public async run(): Promise<boolean> {
    const { stdin, stdout } = process;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide Cursor

    const render = () => {
      // Clear line
      stdout.write("\x1B[2K\r");

      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);

      // Visual Toggle
      const yesLabel = this.value
        ? chalk.bgGreen.black.bold(" Yes ")
        : chalk.dim(" Yes ");

      const noLabel = !this.value
        ? chalk.bgRed.white.bold(" No ")
        : chalk.dim(" No ");

      stdout.write(`${qMark}${title}  ${yesLabel}  ${noLabel}`);
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        stdout.write("\x1B[?25h"); // Show cursor
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
      };

      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string },
      ) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          stdout.write("\n");
          process.exit(0);
        }

        switch (key.name) {
          case "left":
          case "right":
          case "tab":
            this.value = !this.value; // Toggle
            render();
            break;

          case "y":
            this.value = true;
            render(); // Re-render to show selection
            // Optional: langsung submit kalau tekan 'y'?
            // Better UX: User still presses Enter to confirm selection visual
            break;

          case "n":
            this.value = false;
            render();
            break;

          case "return":
          case "enter": {
            cleanup();

            // Clear line & Print Result
            stdout.write("\x1B[2K\r");
            const finalRes = this.value ? chalk.green("Yes") : chalk.red("No");
            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(
                this.config.title,
              )} ${finalRes}\n`,
            );

            resolve(this.value);
            break;
          }
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

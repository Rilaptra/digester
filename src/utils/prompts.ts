import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";
import { generateLog } from "./logger.js";

/**
 * Prompts the user for a Yes/No confirmation.
 *
 * @param {string} question - The question to display.
 * @returns {Promise<boolean>} True if 'y' or 'Y' or Enter is pressed, False otherwise.
 */
export async function promptYesNo(question: string): Promise<boolean> {
  process.stdout.write(question);

  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  return new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      const key = data.toString().trim().toLowerCase();
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      process.stdout.write("\n");
      // Defaulting to yes if just Enter is pressed? Logic below implies strict 'n' check.
      resolve(key !== "n");
    });
  });
}

/**
 * Prompts the user to select *one* option from a list.
 *
 * @param {string} question - The prompt text.
 * @param {string[]} options - Array of available options.
 * @returns {Promise<string>} The selected option string.
 */
export async function promptSelect(
  question: string,
  options: string[],
): Promise<string> {
  generateLog({ type: "info", raw: true }, question);
  options.forEach((opt, idx) => {
    generateLog(
      { type: "info", raw: true },
      `  ${chalk.cyan(idx + 1)}. ${opt}`,
    );
  });
  process.stdout.write(chalk.yellow("  > Select number: "));

  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.resume();

  return new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      const idx = parseInt(data.toString().trim(), 10) - 1;
      process.stdin.pause();

      if (Number.isNaN(idx) || idx < 0 || idx >= options.length) {
        generateLog(
          { type: "error" },
          chalk.red("Invalid selection. Defaulting to first option."),
        );
        resolve(options[0]);
      } else {
        resolve(options[idx]);
      }
    });
  });
}

/**
 * Prompts the user to select *multiple* options using comma-separated indices.
 *
 * @param {string} question - The prompt text.
 * @param {string[]} options - Array of available options.
 * @returns {Promise<string[]>} Array of selected option strings.
 */
export async function promptMultiSelect(
  question: string,
  options: string[],
): Promise<string[]> {
  generateLog({ type: "info", raw: true }, question);
  options.forEach((opt, idx) => {
    generateLog(
      { type: "info", raw: true },
      `  ${chalk.cyan(idx + 1)}. ${opt}`,
    );
  });
  process.stdout.write(
    chalk.yellow(
      "  > Select numbers (comma separated, e.g. 1,2,5) or leave empty: ",
    ),
  );

  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(false);
  }
  process.stdin.resume();

  return new Promise((resolve) => {
    process.stdin.once("data", (data) => {
      const input = data.toString().trim();
      process.stdin.pause();

      if (!input) {
        resolve([]);
        return;
      }

      const indices = input
        .split(",")
        .map((x) => parseInt(x.trim(), 10) - 1)
        .filter(
          (idx) => !Number.isNaN(idx) && idx >= 0 && idx < options.length,
        );

      resolve(indices.map((idx) => options[idx]));
    });
  });
}

/**
 * Interactive Select Menu V2 with Grid Support & 4-Way Navigation.
 *
 * @param {string} question - The question/title to display.
 * @param {string[]} options - List of choices.
 * @param {object} [config] - Configuration object.
 * @param {boolean} [config.allowCustom] - If true, adds "Other..." option for custom input.
 * @param {number} [config.columns=1] - Number of columns for grid layout (1, 2, or 3).
 * @returns {Promise<string>} The selected value.
 */
export async function promptSelectV2(
  question: string,
  options: string[],
  config: {
    allowCustom?: boolean;
    columns?: number;
  } = {},
): Promise<string> {
  const { allowCustom = false, columns = 1 } = config;
  const choices = allowCustom ? [...options, "Other..."] : options;
  let index = 0;

  const maxLabelLength = Math.max(...choices.map((c) => c.length));
  const colWidth = maxLabelLength + 5;
  const totalRows = Math.ceil(choices.length / columns);

  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
  process.stdin.resume();
  emitKeypressEvents(process.stdin);
  process.stdout.write("\x1B[?25l"); // Hide Cursor

  const render = (firstRender = false) => {
    if (!firstRender) {
      process.stdout.write(`\x1B[${totalRows + 1}A`); // Move up
    }

    process.stdout.write(`${chalk.cyan(`? ${question}`)}\n`);

    for (let row = 0; row < totalRows; row++) {
      let lineOutput = "";
      for (let col = 0; col < columns; col++) {
        const itemIndex = row * columns + col;

        if (itemIndex < choices.length) {
          const isSelected = itemIndex === index;
          const label = choices[itemIndex];
          const pointer = isSelected ? chalk.cyan("❯") : " ";
          const text = isSelected ? chalk.cyan.bold(label) : chalk.dim(label);
          const padding = " ".repeat(colWidth - label.length - 2);
          lineOutput += `${pointer} ${text}${padding}`;
        }
      }
      process.stdout.write(` ${lineOutput}\x1B[K\n`);
    }
  };

  render(true);

  return new Promise((resolve) => {
    const handleKey = async (
      _ch: string,
      key: { name: string; ctrl: boolean },
    ) => {
      if (key.ctrl && key.name === "c") {
        process.stdout.write("\x1B[?25h");
        process.exit(0);
      }

      switch (key.name) {
        case "left":
          index = (index - 1 + choices.length) % choices.length;
          render();
          break;
        case "right":
          index = (index + 1) % choices.length;
          render();
          break;
        case "up":
          if (index - columns >= 0) {
            index -= columns;
          } else {
            const target = index + (totalRows - 1) * columns;
            index = target < choices.length ? target : target - columns;
            if (index >= choices.length) index = choices.length - 1;
          }
          render();
          break;
        case "down":
          if (index + columns < choices.length) {
            index += columns;
          } else {
            index = index % columns;
          }
          render();
          break;
        case "return":
        case "enter": {
          process.stdin.removeListener("keypress", handleKey);
          if (process.stdin.setRawMode) process.stdin.setRawMode(false);
          process.stdin.pause();

          process.stdout.write(`\x1B[${totalRows + 1}A`);
          process.stdout.write("\x1B[0J");
          process.stdout.write("\x1B[?25h");

          const selection = choices[index];
          generateLog(
            { type: "success", raw: true },
            `${chalk.cyan(`? ${question}`)} ${chalk.green(selection)}`,
          );

          if (allowCustom && selection === "Other...") {
            const custom = await promptText(
              chalk.yellow("   👉 Enter value: "),
            );
            resolve(custom || "Other");
          } else {
            resolve(selection);
          }
          break;
        }
      }
    };

    process.stdin.on("keypress", handleKey);
  });
}

/**
 * Prompts the user for a standard text input.
 *
 * @param {string} question - The text to display.
 * @returns {Promise<string>} The user's input trimmed.
 */
export async function promptText(question: string): Promise<string> {
  const answer = await new Promise<string>((resolve) => {
    process.stdout.write(question);

    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    process.stdin.resume();

    process.stdin.once("data", (data) => {
      process.stdin.pause();
      resolve(data.toString().trim());
    });
  });
  return answer;
}
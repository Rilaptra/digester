/** biome-ignore-all lint/style/noNonNullAssertion: <explanation: step is always defined> */
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export interface SpinConfig {
  title: string;
  min?: number;
  max?: number;
  step?: number;
  initial?: number;
  unit?: string; // e.g "MB", "px", "ms"
}

export class SpinNumber {
  private config: SpinConfig;
  private value: number;

  constructor(config: SpinConfig) {
    this.config = { step: 1, ...config };
    this.value = config.initial || config.min || 0;
  }

  public async run(): Promise<number> {
    const { stdin, stdout } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l");

    const render = () => {
      stdout.write("\x1B[2K\r");

      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);

      const valStr = this.value.toString();
      const unitStr = this.config.unit ? chalk.dim(` ${this.config.unit}`) : "";

      // Visual Arrow Style
      // Kiri aktif kalau > min, Kanan aktif kalau < max
      const canDec =
        this.config.min === undefined || this.value > this.config.min;
      const canInc =
        this.config.max === undefined || this.value < this.config.max;

      const leftArr = canDec ? chalk.cyan("❮") : chalk.gray("❮");
      const rightArr = canInc ? chalk.cyan("❯") : chalk.gray("❯");

      const valueDisplay = chalk.green.bold(` ${valStr}${unitStr} `);

      stdout.write(`${qMark}${title}  ${leftArr}${valueDisplay}${rightArr}`);
    };

    render();

    return new Promise((resolve) => {
      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; shift: boolean },
      ) => {
        if (key.ctrl && key.name === "c") {
          stdout.write("\n\x1B[?25h");
          process.exit(0);
        }

        const step = key.shift ? this.config.step! * 10 : this.config.step!;

        switch (key.name) {
          case "left":
          case "down":
            // Decrement
            if (
              this.config.min === undefined ||
              this.value - step >= this.config.min
            ) {
              this.value -= step;
            } else if (this.config.min !== undefined) {
              this.value = this.config.min;
            }
            render();
            break;

          case "right":
          case "up":
            // Increment
            if (
              this.config.max === undefined ||
              this.value + step <= this.config.max
            ) {
              this.value += step;
            } else if (this.config.max !== undefined) {
              this.value = this.config.max;
            }
            render();
            break;

          case "return":
          case "enter": {
            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("keypress", handleKey);

            stdout.write("\n\x1B[?25h");
            // Clear line and log clean result
            stdout.write(`\x1B[A\x1B[2K\r`);
            const unit = this.config.unit || "";
            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.green(this.value + unit)}\n`,
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

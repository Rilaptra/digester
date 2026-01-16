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

  // 🔥 NEW: State buat manual typing
  private buffer = "";
  private isEditing = false;

  constructor(config: SpinConfig) {
    this.config = { step: 1, ...config };
    this.value = config.initial ?? config.min ?? 0;
  }

  /**
   * Helper: Commit buffer string ke number value.
   * Dipanggil pas user tekan Enter atau switch dari ngetik ke arrow keys.
   */
  private commitBuffer() {
    if (!this.isEditing || this.buffer === "" || this.buffer === "-") {
      this.isEditing = false;
      this.buffer = "";
      return;
    }

    let parsed = Number.parseFloat(this.buffer);

    // Robustness Check: Valid Number?
    if (Number.isNaN(parsed)) {
      parsed = this.value; // Revert to last valid
    }

    this.value = this.clamp(parsed);
    this.isEditing = false;
    this.buffer = "";
  }

  /**
   * Helper: Clamp value biar gak keluar batas Min/Max
   */
  private clamp(val: number): number {
    let final = val;
    if (this.config.min !== undefined && final < this.config.min) {
      final = this.config.min;
    }
    if (this.config.max !== undefined && final > this.config.max) {
      final = this.config.max;
    }
    return final;
  }

  public async run(): Promise<number> {
    const { stdin, stdout } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide cursor default

    const render = () => {
      stdout.write("\x1B[2K\r"); // Clear line

      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);

      // --- VISUAL LOGIC ---
      let valueDisplay = "";
      const unitStr = this.config.unit ? chalk.dim(` ${this.config.unit}`) : "";

      if (this.isEditing) {
        // Mode Typing: Warna Kuning/Cyan + Cursor visual underscore
        valueDisplay = chalk.yellow(`${this.buffer}_`);
      } else {
        // Mode View/Spin: Warna Hijau Bold
        valueDisplay = chalk.green.bold(`${this.value}`);
      }

      // Arrow indicators (Dimmed kalau lagi mode typing)
      const canDec =
        this.config.min === undefined || this.value > this.config.min;
      const canInc =
        this.config.max === undefined || this.value < this.config.max;

      let leftArr = canDec ? "❮" : "";
      let rightArr = canInc ? "❯" : "";

      if (this.isEditing) {
        // Hide arrows saat typing biar fokus
        leftArr = chalk.dim(" ");
        rightArr = chalk.dim(" ");
      } else {
        leftArr = canDec ? chalk.cyan("❮") : chalk.gray("❮");
        rightArr = canInc ? chalk.cyan("❯") : chalk.gray("❯");
      }

      stdout.write(
        `${qMark}${title}  ${leftArr} ${valueDisplay}${unitStr} ${rightArr}`,
      );
    };

    render();

    return new Promise((resolve) => {
      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; shift: boolean; sequence: string },
      ) => {
        if (key.ctrl && key.name === "c") {
          stdout.write("\n\x1B[?25h");
          process.exit(0);
        }

        const step = key.shift ? this.config.step! * 10 : this.config.step!;

        // --- INPUT HANDLING ---

        // 1. NAVIGATION / SPINNING (Arrow Keys)
        if (["up", "down", "left", "right"].includes(key.name)) {
          // Kalau sebelumnya lagi ngetik, commit dulu nilainya
          if (this.isEditing) {
            this.commitBuffer();
          }

          if (key.name === "left" || key.name === "down") {
            // Decrement
            const nextVal = this.value - step;
            this.value = this.clamp(nextVal);
          } else {
            // Increment
            const nextVal = this.value + step;
            this.value = this.clamp(nextVal);
          }
          render();
          return;
        }

        // 2. SUBMISSION (Enter)
        if (key.name === "return" || key.name === "enter") {
          // Commit buffer if editing
          this.commitBuffer();

          if (stdin.setRawMode) stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("keypress", handleKey);

          stdout.write("\n\x1B[?25h");
          // Clean output log
          stdout.write(`\x1B[A\x1B[2K\r`);
          const unit = this.config.unit || "";
          stdout.write(
            `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.green(this.value + unit)}\n`,
          );

          resolve(this.value);
          return;
        }

        // 3. MANUAL TYPING
        // Regex: Digits (0-9), Minus (-) di awal, Dot (.) untuk desimal
        if (/^[\d.-]$/.test(key.sequence)) {
          if (!this.isEditing) {
            this.isEditing = true;
            this.buffer = ""; // Reset buffer on first type
          }

          // Robustness: Jangan bolehin minus di tengah atau multiple dots
          if (key.sequence === "-" && this.buffer.length > 0) return;
          if (key.sequence === "." && this.buffer.includes(".")) return;

          this.buffer += key.sequence;
          render();
          return;
        }

        // 4. BACKSPACE
        if (key.name === "backspace") {
          if (this.isEditing) {
            this.buffer = this.buffer.slice(0, -1);
            // Kalau buffer habis, balik ke mode view value terakhir
            if (this.buffer.length === 0) {
              this.isEditing = false;
            }
            render();
          }
          return;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

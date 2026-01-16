import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export interface TextPromptConfig {
  title: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | boolean | Promise<string | boolean>;
  password?: boolean;
}

export class TextPrompt {
  private config: TextPromptConfig;
  private value = "";
  private cursorPos = 0;
  private errorMsg = "";

  constructor(config: TextPromptConfig) {
    this.config = config;
    this.value = config.initialValue || "";
    this.cursorPos = this.value.length;
  }

  public async run(): Promise<string> {
    const { stdin, stdout } = process;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);

    // Kita handle kursor sendiri, tapi kita butuh kursor terminal nyala
    // di posisi yang tepat.

    let isSubmitting = false;

    const render = () => {
      // 1. Move Cursor to start & Clear entire line + potentially error line below
      stdout.write("\x1B[2K\r");
      // Clear line below (in case of previous error)
      stdout.write("\x1B[B\x1B[2K\x1B[A");

      // 2. Render Prompt
      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);

      // 3. Render Value / Placeholder
      let displayValue = this.value;
      if (this.config.password) {
        displayValue = "*".repeat(this.value.length);
      }

      // Warna value
      let valueStr = chalk.green(displayValue);

      // Placeholder logic
      if (this.value.length === 0 && this.config.placeholder) {
        valueStr = chalk.dim(this.config.placeholder);
      }

      stdout.write(`${qMark}${title} › ${valueStr}`);

      // 4. Render Error if exists (di baris bawah)
      if (this.errorMsg) {
        stdout.write(`\n${chalk.red("✖ " + this.errorMsg)}`);
        stdout.write("\x1B[A"); // Balik ke baris input
      }

      // 5. Position Cursor visually
      // Panjang: "? " (2) + Title + " › " (3) + cursorPos
      // Note: Kita harus hitung panjang visual tanpa kode warna
      const prefixLen = 2 + this.config.title.length + 3;

      // Kalau value kosong tapi ada placeholder, kursor tetap di 0
      const visualCursor = prefixLen + this.cursorPos;

      // Pindahkan kursor terminal ke posisi yang benar
      stdout.write(`\x1B[${visualCursor + 1}G`);
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
        // Hapus baris error kalau ada
        stdout.write("\n\x1B[2K\x1B[A");
      };

      const handleKey = async (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string }
      ) => {
        if (isSubmitting) return; // Prevent double submit

        // Reset error on type
        if (this.errorMsg) {
          this.errorMsg = "";
          render();
        }

        if (key.ctrl && key.name === "c") {
          cleanup();
          stdout.write("\n");
          process.exit(0);
        }

        switch (key.name) {
          case "return":
          case "enter": {
            isSubmitting = true;
            // Validation
            if (this.config.validate) {
              const result = await this.config.validate(this.value);
              if (typeof result === "string") {
                this.errorMsg = result;
                isSubmitting = false;
                render();
                return;
              }
              if (result === false) {
                this.errorMsg = "Invalid input";
                isSubmitting = false;
                render();
                return;
              }
            }

            cleanup();
            stdout.write("\x1B[2K\r"); // Clear Line

            // Mask password in final log
            const finalShow = this.config.password
              ? "*".repeat(this.value.length)
              : this.value;

            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(
                this.config.title
              )} ${chalk.green(finalShow)}\n`
            );
            resolve(this.value);
            break;
          }

          case "backspace":
            if (this.cursorPos > 0) {
              // Remove char at cursorPos - 1
              this.value =
                this.value.slice(0, this.cursorPos - 1) +
                this.value.slice(this.cursorPos);
              this.cursorPos--;
              render();
            }
            break;

          case "delete":
            if (this.cursorPos < this.value.length) {
              this.value =
                this.value.slice(0, this.cursorPos) +
                this.value.slice(this.cursorPos + 1);
              render();
            }
            break;

          case "left":
            if (this.cursorPos > 0) {
              this.cursorPos--;
              render();
            }
            break;

          case "right":
            if (this.cursorPos < this.value.length) {
              this.cursorPos++;
              render();
            }
            break;

          case "home": // Mac/Linux might differ, standard attempt
            this.cursorPos = 0;
            render();
            break;

          case "end":
            this.cursorPos = this.value.length;
            render();
            break;

          default:
            // Input Karakter Biasa
            if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
              // Insert at cursor position
              this.value =
                this.value.slice(0, this.cursorPos) +
                key.sequence +
                this.value.slice(this.cursorPos);
              this.cursorPos++;
              render();
            }
            break;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

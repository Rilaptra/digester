import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export interface AutoCompleteConfig {
  title: string;
  options: string[];
  limit?: number;
  clearOnSubmit?: boolean;
}

export class AutoComplete {
  private config: AutoCompleteConfig;
  private input = "";
  private cursorPos = 0;

  private suggestions: string[] = [];
  private selectedIndex = 0;
  private scrollOffset = 0; // 🔥 State untuk scrolling
  private lastRenderHeight = 0;

  constructor(config: AutoCompleteConfig) {
    this.config = { ...config, limit: config.limit || 5 };
  }

  private filterOptions() {
    if (!this.input) {
      this.suggestions = [];
      this.selectedIndex = 0;
      this.scrollOffset = 0;
      return;
    }
    const lower = this.input.toLowerCase();
    this.suggestions = this.config.options.filter((opt) =>
      opt.toLowerCase().includes(lower)
    );
    // Reset selection & scroll tiap ketik
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  public async run(): Promise<string> {
    const { stdin, stdout } = process;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);

    stdout.write("\x1B[?25l");

    const render = () => {
      // 1. CLEANUP OLD RENDER
      if (this.lastRenderHeight > 0) {
        stdout.write("\x1B[J");
      }

      // 2. CLEAR INPUT LINE
      stdout.write("\x1B[2K\r");

      // 3. RENDER INPUT
      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);
      const pointer = chalk.dim("›");

      stdout.write(`${qMark}${title} ${pointer} ${this.input}`);

      // 4. RENDER SUGGESTIONS (SCROLLABLE)
      const limit = this.config.limit || 5;
      const total = this.suggestions.length;

      // Hitung Viewport
      // Kita ambil slice dari [scrollOffset ... scrollOffset + limit]
      const visibleSuggestions = this.suggestions.slice(
        this.scrollOffset,
        this.scrollOffset + limit
      );

      let linesToPrint: string[] = [];

      if (visibleSuggestions.length > 0) {
        // Cari max length untuk padding scrollbar
        const maxLen = Math.max(...this.suggestions.map((s) => s.length));
        const colWidth = maxLen + 4; // Buffer dikit

        linesToPrint = visibleSuggestions.map((sug, idx) => {
          // Real index di data asli
          const realIndex = this.scrollOffset + idx;
          const isSelected = realIndex === this.selectedIndex;

          const prefix = isSelected ? chalk.cyan("❯") : " ";
          const text = isSelected ? chalk.cyan.bold(sug) : chalk.dim(sug);

          // Padding Logic biar Scrollbar Rapi
          // Panjang visual: prefix(2) + sug.length
          // Kita butuh padding sisa
          const paddingNeeded = Math.max(1, colWidth - (2 + sug.length));
          const padding = " ".repeat(paddingNeeded);

          // Scrollbar Logic
          let scrollBar = " ";
          if (total > limit) {
            if (realIndex === this.scrollOffset && this.scrollOffset > 0)
              scrollBar = "▲";
            else if (
              realIndex === this.scrollOffset + limit - 1 &&
              this.scrollOffset + limit < total
            )
              scrollBar = "▼";
            else scrollBar = "│";
          }

          // Warna Scrollbar (Dim)
          return `${prefix} ${text}${padding}${chalk.dim(scrollBar)}`;
        });
      }

      // 5. PRINT SUGGESTIONS
      if (linesToPrint.length > 0) {
        stdout.write("\n");
        stdout.write(linesToPrint.join("\n"));

        this.lastRenderHeight = linesToPrint.length;

        // Balikin cursor ke input line
        stdout.write(`\x1B[${this.lastRenderHeight}A`);
      } else {
        this.lastRenderHeight = 0;
      }

      // 6. POSISIKAN CURSOR INPUT
      const prefixLen = 2 + this.config.title.length + 3;
      const visualCursor = prefixLen + this.cursorPos;

      stdout.write(`\x1B[${visualCursor + 1}G`);
      stdout.write("\x1B[?25h");
    };

    render();

    return new Promise((resolve) => {
      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string }
      ) => {
        if (key.ctrl && key.name === "c") {
          if (this.lastRenderHeight > 0) stdout.write("\x1B[J");
          stdout.write("\n");
          process.exit(0);
        }

        switch (key.name) {
          case "return":
          case "enter": {
            let finalValue = this.input;
            if (this.suggestions.length > 0) {
              // Ambil selected index yang bener (dari data asli)
              finalValue = this.suggestions[this.selectedIndex];
            }

            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("keypress", handleKey);

            stdout.write("\x1B[J");
            stdout.write("\x1B[2K\r");

            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(
                this.config.title
              )} ${chalk.green(finalValue)}\n`
            );

            resolve(finalValue);
            break;
          }

          case "tab":
            if (this.suggestions.length > 0) {
              this.input = this.suggestions[this.selectedIndex];
              this.cursorPos = this.input.length;
              this.filterOptions();
              render();
            }
            break;

          case "up":
            if (this.suggestions.length > 0) {
              this.selectedIndex--;

              // Logic Wrap Around
              if (this.selectedIndex < 0) {
                this.selectedIndex = this.suggestions.length - 1;
                // Adjust Scroll ke paling bawah
                const limit = this.config.limit || 5;
                this.scrollOffset = Math.max(
                  0,
                  this.suggestions.length - limit
                );
              }

              // Logic Scroll Up
              else if (this.selectedIndex < this.scrollOffset) {
                this.scrollOffset = this.selectedIndex;
              }

              render();
            }
            break;

          case "down":
            if (this.suggestions.length > 0) {
              this.selectedIndex++;

              // Logic Wrap Around
              if (this.selectedIndex >= this.suggestions.length) {
                this.selectedIndex = 0;
                this.scrollOffset = 0;
              }

              // Logic Scroll Down
              else {
                const limit = this.config.limit || 5;
                if (this.selectedIndex >= this.scrollOffset + limit) {
                  this.scrollOffset = this.selectedIndex - limit + 1;
                }
              }

              render();
            }
            break;

          case "backspace":
            if (this.cursorPos > 0) {
              this.input =
                this.input.slice(0, this.cursorPos - 1) +
                this.input.slice(this.cursorPos);
              this.cursorPos--;
              this.filterOptions();
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
            if (this.cursorPos < this.input.length) {
              this.cursorPos++;
              render();
            }
            break;

          default:
            if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
              this.input =
                this.input.slice(0, this.cursorPos) +
                key.sequence +
                this.input.slice(this.cursorPos);
              this.cursorPos++;
              this.filterOptions();
              render();
            }
            break;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

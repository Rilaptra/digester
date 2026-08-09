// --- src/utils/tui/AutoComplete.ts ---
/** biome-ignore-all lint/style/noNonNullAssertion: <explanation: biome-ignore> */

import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export type AutoCompleteSuggester = (
  token: string,
  fullInput: string,
) => Promise<string[]> | string[];

export interface AutoCompleteConfig {
  title: string;
  suggest: AutoCompleteSuggester;
  separator?: string | RegExp;
  limit?: number;
  initialValue?: string;
  /**
   * 🔥 BARU: Select Mode
   *
   * false (default) → Enter konfirmasi teks yang diketik (command-line style)
   * true            → Enter PILIH suggestion yang di-highlight (search-select style)
   *
   * Pakai true untuk config editor, pakai false untuk command input.
   */
  selectMode?: boolean;
}

export class AutoComplete {
  private config: AutoCompleteConfig;
  private input = "";
  private cursorPos = 0;

  private suggestions: string[] = [];
  private selectedIndex = 0;
  private scrollOffset = 0;
  private lastRenderHeight = 0;

  private activeToken = "";
  private tokenStart = 0;
  private tokenEnd = 0;

  // 🔥 BARU: Track apakah user sudah pernah ngetik
  // Biar kita tau apakah input di-modifikasi manual atau belum
  protected hasTyped = false;

  constructor(config: AutoCompleteConfig) {
    this.config = {
      limit: 10,
      separator: " ",
      selectMode: false,
      ...config,
    };

    // 🔥 FIX: Cegah eksplisit 'undefined' nimpuk default separator
    if (this.config.separator === undefined) {
      this.config.separator = " ";
    }

    this.input = config.initialValue || "";
    this.cursorPos = this.input.length;
  }

  private async refreshSuggestions() {
    const sep = this.config.separator!;
    let start = 0;
    let end = this.input.length;

    for (let i = this.cursorPos - 1; i >= 0; i--) {
      if (this.input[i].match(sep)) {
        start = i + 1;
        break;
      }
    }
    for (let i = this.cursorPos; i < this.input.length; i++) {
      if (this.input[i].match(sep)) {
        end = i;
        break;
      }
    }

    this.tokenStart = start;
    this.tokenEnd = end;
    this.activeToken = this.input.slice(start, end);

    try {
      const rawSuggestions = await this.config.suggest(
        this.activeToken,
        this.input,
      );
      this.suggestions = rawSuggestions;

      if (this.selectedIndex >= this.suggestions.length) {
        this.selectedIndex = 0;
        this.scrollOffset = 0;
      }
    } catch {
      this.suggestions = [];
    }
  }

  public async run(): Promise<string> {
    const { stdin, stdout } = process;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);

    await this.refreshSuggestions();

    stdout.write("\x1B[?25l");

    const render = () => {
      // 1. CLEANUP
      if (this.lastRenderHeight > 0) {
        stdout.write(`\x1B[${this.lastRenderHeight}B`);
        stdout.write(`\x1B[${this.lastRenderHeight}A`);
        stdout.write("\x1B[J");
      }

      // 2. RENDER INPUT LINE
      stdout.write("\x1B[2K\r");
      const qMark = chalk.cyan("? ");
      const title = chalk.bold(this.config.title);
      const pointer = chalk.dim("›");

      const before = this.input.slice(0, this.tokenStart);
      const token = this.input.slice(this.tokenStart, this.tokenEnd);
      const after = this.input.slice(this.tokenEnd);

      const coloredInput = `${before}${chalk.underline(token)}${after}`;

      // 🔥 BARU: Show mode hint di selectMode
      const modeHint = this.config.selectMode
        ? chalk.dim(" [↑↓ navigate, Enter select]")
        : "";

      stdout.write(`${qMark}${title} ${pointer} ${coloredInput}${modeHint}`);

      // 3. RENDER SUGGESTIONS
      const limit = this.config.limit || 5;
      const total = this.suggestions.length;
      let linesToPrint: string[] = [];

      if (total > 0) {
        const visible = this.suggestions.slice(
          this.scrollOffset,
          this.scrollOffset + limit,
        );

        linesToPrint = visible.map((sug, idx) => {
          const realIndex = this.scrollOffset + idx;
          const isSelected = realIndex === this.selectedIndex;

          const matchLen = this.activeToken.length;
          let displaySug = sug;

          if (
            sug.toLowerCase().startsWith(this.activeToken.toLowerCase()) &&
            matchLen > 0
          ) {
            displaySug =
              chalk.cyan(sug.slice(0, matchLen)) +
              chalk.dim(sug.slice(matchLen));
          } else {
            displaySug = chalk.dim(sug);
          }

          if (isSelected) {
            // 🔥 BARU: Di selectMode, highlight lebih jelas
            if (this.config.selectMode) {
              return `${chalk.cyan("❯")} ${chalk.bold.white(sug)}`;
            }
            return `${chalk.cyan("❯")} ${chalk.bold.white(sug)}`;
          }
          return `  ${displaySug}`;
        });

        if (total > limit) {
          const progress = Math.round(
            (this.scrollOffset / (total - limit)) * 100,
          );
          linesToPrint.push(
            chalk.dim(
              `  [${progress}%] (${this.scrollOffset + 1}-${Math.min(this.scrollOffset + limit, total)}/${total})`,
            ),
          );
        }
      } else {
        // 🔥 BARU: Show "no match" feedback
        if (this.activeToken.length > 0) {
          linesToPrint.push(
            chalk.dim(`  (no match for "${this.activeToken}")`),
          );
        }
      }

      // 4. PRINT SUGGESTIONS
      if (linesToPrint.length > 0) {
        stdout.write("\n");
        stdout.write(linesToPrint.join("\n"));
        this.lastRenderHeight = linesToPrint.length;
        stdout.write(`\x1B[${this.lastRenderHeight}A`);
      } else {
        this.lastRenderHeight = 0;
      }

      // 5. POSITION CURSOR
      const prefixLen =
        2 + this.config.title.length + 3 + (this.config.selectMode ? 30 : 0); // adjust for mode hint
      const visualCursor = prefixLen + this.cursorPos;
      stdout.write(`\x1B[${Math.min(visualCursor + 1, 200)}G`);
    };

    render();

    return new Promise((resolve) => {
      const handleKey = async (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string },
      ) => {
        if (key.ctrl && key.name === "c") {
          stdout.write("\n\x1B[J\x1B[?25h");
          process.exit(0);
        }

        switch (key.name) {
          case "return":
          case "enter": {
            stdout.write("\x1B[J");
            stdout.write("\x1B[2K\r");

            // ═══════════════════════════════════════
            // 🔥 FIX: selectMode logic
            // ═══════════════════════════════════════
            let finalValue: string;

            if (this.config.selectMode) {
              // SELECT MODE: Enter = pilih suggestion yang di-highlight
              if (this.suggestions.length > 0) {
                // Ada suggestions → return yang di-highlight
                finalValue = this.suggestions[this.selectedIndex];
              } else {
                // Nggak ada suggestions → return teks mentah (custom input)
                finalValue = this.input.trim();
              }
            } else {
              // NORMAL MODE: Enter = konfirmasi teks (behavior lama)
              finalValue = this.input;
            }

            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.green(finalValue)}\n`,
            );

            cleanup();
            resolve(finalValue);
            break;
          }

          case "tab":
            if (this.suggestions.length > 0) {
              const selected = this.suggestions[this.selectedIndex];

              const before = this.input.slice(0, this.tokenStart);
              const after = this.input.slice(this.tokenEnd);

              let insertion = selected;
              if (!insertion.endsWith("/") && !insertion.endsWith(" ")) {
                insertion += " ";
              }

              this.input = before + insertion + after;
              this.cursorPos = (before + insertion).length;

              await this.refreshSuggestions();
              render();
            }
            break;

          case "up":
            if (this.suggestions.length > 0) {
              this.selectedIndex--;
              if (this.selectedIndex < 0) {
                this.selectedIndex = this.suggestions.length - 1;
                this.scrollOffset = Math.max(
                  0,
                  this.suggestions.length - (this.config.limit || 5),
                );
              } else if (this.selectedIndex < this.scrollOffset) {
                this.scrollOffset = this.selectedIndex;
              }
              render();
            }
            break;

          case "down":
            if (this.suggestions.length > 0) {
              this.selectedIndex++;
              const limit = this.config.limit || 5;
              if (this.selectedIndex >= this.suggestions.length) {
                this.selectedIndex = 0;
                this.scrollOffset = 0;
              } else if (this.selectedIndex >= this.scrollOffset + limit) {
                this.scrollOffset = this.selectedIndex - limit + 1;
              }
              render();
            }
            break;

          case "left":
            if (this.cursorPos > 0) {
              this.cursorPos--;
              await this.refreshSuggestions();
              render();
            }
            break;
          case "right":
            if (this.cursorPos < this.input.length) {
              this.cursorPos++;
              await this.refreshSuggestions();
              render();
            }
            break;
          case "backspace":
            if (this.cursorPos > 0) {
              this.input =
                this.input.slice(0, this.cursorPos - 1) +
                this.input.slice(this.cursorPos);
              this.cursorPos--;
              this.hasTyped = true;
              await this.refreshSuggestions();
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
              this.hasTyped = true;
              await this.refreshSuggestions();
              render();
            }
            break;
        }
      };

      const cleanup = () => {
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
        stdout.write("\x1B[?25h");
      };

      stdin.on("keypress", handleKey);
    });
  }
}

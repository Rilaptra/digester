import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export interface EditorConfig {
  title: string;
  initialValue?: string;
  placeholder?: string;
}

export class Editor {
  private config: EditorConfig;
  private lines: string[] = [""];
  private cursorX = 0;
  private cursorY = 0;

  constructor(config: EditorConfig) {
    this.config = config;
    if (config.initialValue) {
      this.lines = config.initialValue.split("\n");
      this.cursorY = this.lines.length - 1;
      this.cursorX = this.lines[this.cursorY].length;
    }
  }

  // --- LOGIC: WORD NAVIGATION ---
  private getWordLeft(line: string, currPos: number): number {
    if (currPos === 0) return 0;
    let i = currPos - 1;
    // Skip trailing spaces
    while (i >= 0 && line[i] === " ") i--;
    // Skip word characters
    while (i >= 0 && line[i] !== " ") i--;
    return i + 1;
  }

  private getWordRight(line: string, currPos: number): number {
    const len = line.length;
    if (currPos >= len) return len;
    let i = currPos;
    // Skip current word
    while (i < len && line[i] !== " ") i++;
    // Skip spaces
    while (i < len && line[i] === " ") i++;
    return i;
  }

  public async run(): Promise<string> {
    const { stdin, stdout } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l");

    const render = () => {
      // 1. Move Cursor Up & Clear
      const rowsUp = this.cursorY + 1;
      if (rowsUp > 0) stdout.write(`\x1B[${rowsUp}A`);
      stdout.write("\r\x1B[J");

      // 2. Render Header
      stdout.write(
        `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.dim(
          "(Ctrl+S/Ctrl+D to save)",
        )}\n`,
      );

      // 3. Render Lines
      this.lines.forEach((line, idx) => {
        const lineNum = chalk.dim(
          `${(idx + 1).toString().padStart(2, " ")} | `,
        );
        let content = line;
        if (
          this.lines.length === 1 &&
          line.length === 0 &&
          this.config.placeholder
        ) {
          content = chalk.gray(this.config.placeholder);
        }
        stdout.write(`${lineNum}${content}\n`);
      });

      // 4. Restore Cursor
      const totalContentLines = this.lines.length;
      const linesToMoveUp = totalContentLines - this.cursorY;
      if (linesToMoveUp > 0) stdout.write(`\x1B[${linesToMoveUp}A`);

      const prefixLen = 5;
      const visualX = prefixLen + this.cursorX;
      stdout.write(`\r\x1B[${visualX}C`);
      stdout.write("\x1B[?25h");
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        const linesDown = this.lines.length - this.cursorY;
        if (linesDown > 0) stdout.write(`\x1B[${linesDown}B`);
        stdout.write("\r\n");
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);

        const uiHeight = 1 + this.lines.length;
        stdout.write(`\x1B[${uiHeight}A\x1B[J`);

        const content = this.lines.join("\n");
        const preview =
          content.length > 50
            ? `${content.substring(0, 50).replace(/\n/g, " ")}...`
            : content.replace(/\n/g, "⏎ ");
        stdout.write(
          `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.green(
            preview,
          )}\n`,
        );
      };

      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string; meta: boolean },
      ) => {
        const currentLine = this.lines[this.cursorY];

        // --- 🔍 DETEKSI TOMBOL ROBUST ---

        // 1. Save (Ctrl+S / Ctrl+D )
        const isSave = key.ctrl && (key.name === "s" || key.name === "d");

        // 2. Ctrl+Backspace
        // Windows/Unix sering ngirim Ctrl+W (\x17) atau \x7f
        const isCtrlBackspace =
          (key.ctrl && key.name === "backspace") ||
          (key.ctrl && key.name === "h") || // Legacy backspace
          (key.ctrl && key.name === "w") || // Unix Word Rubout
          key.sequence === "\x17"; // Raw Ctrl+W

        // 3. Ctrl+Delete
        // Xterm style: \x1b[3;5~
        const isCtrlDelete = key.sequence === "\u001Bd";

        // 4. Navigation (Ctrl+Arrows)
        const isCtrlLeft = key.ctrl && key.name === "left";
        const isCtrlRight = key.ctrl && key.name === "right";

        // --- ACTION HANDLERS ---

        if (isSave) {
          cleanup();
          resolve(this.lines.join("\n"));
          return;
        }

        if (key.ctrl && key.name === "c") {
          stdout.write("\n");
          process.exit(0);
        }

        // --- WORD DELETE LEFT (Ctrl+Backspace) ---
        if (isCtrlBackspace) {
          if (this.cursorX > 0) {
            const wordStart = this.getWordLeft(currentLine, this.cursorX);
            const newLine =
              currentLine.slice(0, wordStart) + currentLine.slice(this.cursorX);
            this.lines[this.cursorY] = newLine;
            this.cursorX = wordStart;
            render();
          } else if (this.cursorY > 0) {
            const prevLine = this.lines[this.cursorY - 1];
            const currentLen = prevLine.length;
            this.lines[this.cursorY - 1] = prevLine + currentLine;
            this.lines.splice(this.cursorY, 1);
            this.cursorY--;
            this.cursorX = currentLen;
            render();
          }
          return;
        }

        // --- WORD DELETE RIGHT (Ctrl+Delete) ---
        if (isCtrlDelete) {
          if (this.cursorX < currentLine.length) {
            const wordEnd = this.getWordRight(currentLine, this.cursorX);
            const newLine =
              currentLine.slice(0, this.cursorX) + currentLine.slice(wordEnd);
            this.lines[this.cursorY] = newLine;
            render();
          } else if (this.cursorY < this.lines.length - 1) {
            const nextLine = this.lines[this.cursorY + 1];
            this.lines[this.cursorY] = currentLine + nextLine;
            this.lines.splice(this.cursorY + 1, 1);
            render();
          }
          return;
        }

        // --- STANDARD NAVIGATION & EDITING ---
        switch (key.name) {
          case "up":
            if (this.cursorY > 0) {
              this.cursorY--;
              this.cursorX = Math.min(
                this.cursorX,
                this.lines[this.cursorY].length,
              );
              render();
            }
            break;
          case "down":
            if (this.cursorY < this.lines.length - 1) {
              this.cursorY++;
              this.cursorX = Math.min(
                this.cursorX,
                this.lines[this.cursorY].length,
              );
              render();
            }
            break;

          case "left":
            if (isCtrlLeft) {
              if (this.cursorX > 0) {
                this.cursorX = this.getWordLeft(currentLine, this.cursorX);
                render();
              } else if (this.cursorY > 0) {
                this.cursorY--;
                this.cursorX = this.lines[this.cursorY].length;
                render();
              }
            } else {
              if (this.cursorX > 0) {
                this.cursorX--;
                render();
              } else if (this.cursorY > 0) {
                this.cursorY--;
                this.cursorX = this.lines[this.cursorY].length;
                render();
              }
            }
            break;

          case "right":
            if (isCtrlRight) {
              if (this.cursorX < currentLine.length) {
                this.cursorX = this.getWordRight(currentLine, this.cursorX);
                render();
              } else if (this.cursorY < this.lines.length - 1) {
                this.cursorY++;
                this.cursorX = 0;
                render();
              }
            } else {
              if (this.cursorX < currentLine.length) {
                this.cursorX++;
                render();
              } else if (this.cursorY < this.lines.length - 1) {
                this.cursorY++;
                this.cursorX = 0;
                render();
              }
            }
            break;

          case "return":
          case "enter":
            // Standard Enter (Newline)
            // Karena Ctrl+Enter udah ditangkap di atas, ini aman buat Newline aja
            {
              const left = currentLine.slice(0, this.cursorX);
              const right = currentLine.slice(this.cursorX);
              this.lines[this.cursorY] = left;
              this.lines.splice(this.cursorY + 1, 0, right);
              this.cursorY++;
              this.cursorX = 0;
              render();
            }
            break;

          case "backspace":
            // Standard Backspace
            if (this.cursorX > 0) {
              const newLine =
                currentLine.slice(0, this.cursorX - 1) +
                currentLine.slice(this.cursorX);
              this.lines[this.cursorY] = newLine;
              this.cursorX--;
              render();
            } else if (this.cursorY > 0) {
              const prevLine = this.lines[this.cursorY - 1];
              const currentLen = prevLine.length;
              this.lines[this.cursorY - 1] = prevLine + currentLine;
              this.lines.splice(this.cursorY, 1);
              this.cursorY--;
              this.cursorX = currentLen;
              render();
            }
            break;

          case "delete":
            // Standard Delete
            if (this.cursorX < currentLine.length) {
              const newLine =
                currentLine.slice(0, this.cursorX) +
                currentLine.slice(this.cursorX + 1);
              this.lines[this.cursorY] = newLine;
              render();
            } else if (this.cursorY < this.lines.length - 1) {
              const nextLine = this.lines[this.cursorY + 1];
              this.lines[this.cursorY] = currentLine + nextLine;
              this.lines.splice(this.cursorY + 1, 1);
              render();
            }
            break;

          default:
            if (
              key.sequence &&
              key.sequence.length === 1 &&
              !key.ctrl &&
              !key.meta
            ) {
              const newLine =
                currentLine.slice(0, this.cursorX) +
                key.sequence +
                currentLine.slice(this.cursorX);
              this.lines[this.cursorY] = newLine;
              this.cursorX++;
              render();
            }
            break;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

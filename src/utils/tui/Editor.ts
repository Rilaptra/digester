// --- src/utils/tui/Editor.ts ---
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

// --- TYPES ---
export interface EditorConfig {
  title: string;
  initialValue?: string;
  placeholder?: string;
}

interface EditorState {
  lines: string[];
  cursorX: number;
  cursorY: number;
  timestamp: number;
}

/**
 * 🔥 EDITOR V5.3: GOD MODE RESIZE
 * - Fixes: Terminal Reflow Artifacts (The "Double Header" Bug)
 * - Secret Weapon: \x1B[?7l (Disable Auto Wrap)
 * - Strategy: Prevent terminal from pushing text down on shrink
 */
export class Editor {
  private config: EditorConfig;
  private lines: string[] = [""];
  private cursorX = 0;
  private cursorY = 0;
  private offsetX = 0;
  private offsetY = 0;

  private termWidth = process.stdout.columns;
  private termHeight = process.stdout.rows;

  private history: EditorState[] = [];
  private historyPointer = -1;
  private lastSnapshotTime = 0;
  private readonly DEBOUNCE_MS = 300;

  private isRunning = false;
  private resizeTimeout: Timer | null = null;

  constructor(config: EditorConfig) {
    this.config = config;
    if (config.initialValue) {
      this.lines = config.initialValue.split("\n");
      this.cursorY = this.lines.length - 1;
      this.cursorX = this.lines[this.cursorY].length;
    }
    this.saveSnapshot(true);
  }

  // --- CORE: HISTORY ---
  private saveSnapshot(force = false) {
    const now = Date.now();
    if (!force && now - this.lastSnapshotTime < this.DEBOUNCE_MS) return;
    if (this.historyPointer < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyPointer + 1);
    }
    this.history.push({
      lines: [...this.lines],
      cursorX: this.cursorX,
      cursorY: this.cursorY,
      timestamp: now,
    });
    this.historyPointer++;
    this.lastSnapshotTime = now;
    if (this.history.length > 50) {
      this.history.shift();
      this.historyPointer--;
    }
  }

  private undo() {
    if (this.historyPointer > 0) {
      this.historyPointer--;
      this.restoreState(this.history[this.historyPointer]);
    }
  }

  private redo() {
    if (this.historyPointer < this.history.length - 1) {
      this.historyPointer++;
      this.restoreState(this.history[this.historyPointer]);
    }
  }

  private restoreState(state: EditorState) {
    this.lines = [...state.lines];
    this.cursorX = state.cursorX;
    this.cursorY = state.cursorY;
    this.ensureCursorVisible();
  }

  // --- CORE: LOGIC ---
  private ensureCursorVisible() {
    const h = Math.max(1, this.termHeight);
    const w = Math.max(1, this.termWidth);
    const viewportH = Math.max(1, h - 3);
    const viewportW = Math.max(1, w - 6);

    if (this.cursorY < this.offsetY) {
      this.offsetY = this.cursorY;
    } else if (this.cursorY >= this.offsetY + viewportH) {
      this.offsetY = this.cursorY - viewportH + 1;
    }

    if (this.cursorX < this.offsetX) {
      this.offsetX = this.cursorX;
    } else if (this.cursorX >= this.offsetX + viewportW) {
      this.offsetX = this.cursorX - viewportW + 1;
    }
  }

  private getWordStartLeft(line: string, pos: number): number {
    if (pos === 0) return 0;
    let i = pos - 1;
    if (line[i] === " ") {
      while (i >= 0 && line[i] === " ") i--;
      return i + 1;
    }
    while (i >= 0 && line[i] !== " " && !/[^a-zA-Z0-9]/.test(line[i])) i--;
    if (i >= 0 && line[i] !== " " && i === pos - 1) return i;
    return i + 1;
  }

  // --- MAIN RUNNER ---
  public async run(): Promise<string> {
    const { stdin, stdout } = process;
    this.isRunning = true;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);

    // SETUP TERMINAL ENVIRONMENT
    // \x1B[?1049h : Alt Buffer
    // \x1B[?25l   : Hide Cursor
    // \x1B[?7l    : DISABLE AUTO WRAP (CRITICAL FIX FOR RESIZE GHOSTING)
    stdout.write("\x1B[?1049h\x1B[?25l\x1B[?7l");

    const handleResize = () => {
      this.termWidth = stdout.columns;
      this.termHeight = stdout.rows;

      // HIDE CURSOR LAGI & MATIKAN WRAP (Just in case VS Code reset)
      stdout.write("\x1B[?25l\x1B[?7l\x1B[2J\x1B[H");

      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
        this.termWidth = stdout.columns;
        this.termHeight = stdout.rows;
        this.ensureCursorVisible();
        render();
      }, 50);
    };

    stdout.on("resize", handleResize);

    const render = () => {
      if (!this.isRunning) return;
      this.termWidth = stdout.columns;
      this.termHeight = stdout.rows;

      let buffer = "";

      // Reset position to home, ensure cursor hidden
      buffer += "\x1B[H\x1B[?25l";

      // 1. RENDER HEADER
      const rawTitle = ` 📝 ${this.config.title} `;
      const safeWidth = Math.max(0, this.termWidth);
      const padLen = Math.max(0, safeWidth - rawTitle.length);
      const fullHeader = rawTitle + " ".repeat(padLen);
      const safeHeader = chalk.bgBlue.white.bold(
        fullHeader.slice(0, safeWidth),
      );

      buffer += `${safeHeader}\x1B[K\x1B[0m`;

      // 2. RENDER BODY
      const viewportH = Math.max(0, this.termHeight - 3);
      const maxLineDigit = String(this.lines.length).length;

      for (let i = 0; i < viewportH; i++) {
        const lineIdx = this.offsetY + i;
        const screenRow = i + 2;

        if (screenRow > this.termHeight - 2) break;

        buffer += `\x1B[${screenRow};1H`;

        if (lineIdx < this.lines.length) {
          const rawLine = this.lines[lineIdx];
          const lineNumStr = (lineIdx + 1)
            .toString()
            .padStart(maxLineDigit, " ");
          const separator = " │ ";
          const gutterLen = maxLineDigit + separator.length;
          const contentWidth = Math.max(0, this.termWidth - gutterLen);

          let content = rawLine;
          if (
            this.lines.length === 1 &&
            rawLine === "" &&
            this.config.placeholder
          ) {
            content = chalk.gray(this.config.placeholder);
          }

          const visibleContent = content.slice(
            this.offsetX,
            this.offsetX + contentWidth,
          );

          const linePrefix =
            lineIdx === this.cursorY
              ? chalk.yellow.bold(lineNumStr) + chalk.dim(separator)
              : chalk.dim(lineNumStr + separator);

          buffer += `${linePrefix + visibleContent}\x1B[K\x1B[0m`;
        } else {
          buffer += `${chalk.dim(" ~")}\x1B[K\x1B[0m`;
        }
      }

      // CLEAR REMAINING LINES (If terminal got taller)
      // Ini penting biar sisa-sisa teks lama dibawah ikut kehapus
      const contentEndRow = Math.min(viewportH + 2, this.termHeight - 1);
      for (let r = contentEndRow; r < this.termHeight - 1; r++) {
        buffer += `\x1B[${r};1H\x1B[K`;
      }

      // 3. RENDER FOOTER
      const statusLeft = ` NORMAL `;
      const statusRight = ` Ln ${this.cursorY + 1}, Col ${this.cursorX + 1} `;
      const barSpaceLen = Math.max(
        0,
        this.termWidth - statusLeft.length - statusRight.length,
      );
      const fullStatus = statusLeft + " ".repeat(barSpaceLen) + statusRight;
      const styledStatus = chalk.bgWhite.black(fullStatus.slice(0, safeWidth));

      const shortcuts = [
        "^S Save",
        "^C Cancel",
        "^W Del Word",
        "^Z Undo",
        "^Y Redo",
      ];
      const scItems = shortcuts
        .map((s) => {
          const [k, d] = s.split(" ");
          return `${chalk.bgBlack.white(` ${k} `)} ${chalk.bgBlack.cyan(`${d} `)}`;
        })
        .join(" ");

      const scRawLen = shortcuts.reduce((acc, s) => acc + s.length + 3, 0) - 1;
      const scPadLen = Math.max(0, this.termWidth - scRawLen);
      const styledSC = scItems + chalk.bgBlack(" ".repeat(scPadLen));

      const statusRow = this.termHeight - 1;
      const scRow = this.termHeight;

      if (statusRow > 1)
        buffer += `\x1B[${statusRow};1H${styledStatus}\x1B[K\x1B[0m`;
      if (scRow > 1) buffer += `\x1B[${scRow};1H${styledSC}\x1B[K\x1B[0m`;

      // 4. POSITION CURSOR
      const screenY = this.cursorY - this.offsetY + 2;
      const lineNumWidth = maxLineDigit + 3;
      const screenX = this.cursorX - this.offsetX + lineNumWidth + 1;

      const isVisible =
        screenY >= 2 &&
        screenY <= viewportH + 1 &&
        screenX > 0 &&
        screenX <= this.termWidth;

      if (isVisible) {
        buffer += `\x1B[${screenY};${screenX}H\x1B[?25h`;
      } else {
        buffer += `\x1B[?25l`;
      }

      stdout.write(buffer);
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        this.isRunning = false;
        if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
        stdout.removeListener("resize", handleResize);

        // RESTORE: Alt Buffer Off, Cursor Show, AUTO WRAP ON
        // \x1B[?7h : PENTING! Nyalakan lagi auto wrap biar terminal normal setelah keluar
        stdout.write("\x1B[?1049l\x1B[?25h\x1B[?7h");

        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
      };

      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; meta: boolean; sequence: string },
      ) => {
        // --- LOGIC KEYPRESS (Sama persis) ---
        const currentLine = this.lines[this.cursorY];

        if (key.ctrl && key.name === "s") {
          cleanup();
          resolve(this.lines.join("\n"));
          return;
        }
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }
        if (key.ctrl && key.name === "z") {
          this.undo();
          render();
          return;
        }
        if (key.ctrl && key.name === "y") {
          this.redo();
          render();
          return;
        }

        const isWordDelete =
          key.sequence === "\x17" ||
          (key.ctrl && key.name === "w") ||
          (key.name === "backspace" && (key.ctrl || key.meta)) ||
          key.sequence === "\b";

        if (key.name === "backspace" || isWordDelete) {
          if (isWordDelete) {
            if (this.cursorX > 0) {
              const start = this.getWordStartLeft(currentLine, this.cursorX);
              this.lines[this.cursorY] =
                currentLine.slice(0, start) + currentLine.slice(this.cursorX);
              this.cursorX = start;
            } else if (this.cursorY > 0) {
              const prevLine = this.lines[this.cursorY - 1];
              const prevLen = prevLine.length;
              this.lines[this.cursorY - 1] = prevLine + currentLine;
              this.lines.splice(this.cursorY, 1);
              this.cursorY--;
              this.cursorX = prevLen;
            }
          } else {
            if (this.cursorX > 0) {
              this.lines[this.cursorY] =
                currentLine.slice(0, this.cursorX - 1) +
                currentLine.slice(this.cursorX);
              this.cursorX--;
            } else if (this.cursorY > 0) {
              const prevLine = this.lines[this.cursorY - 1];
              this.lines[this.cursorY - 1] = prevLine + currentLine;
              this.lines.splice(this.cursorY, 1);
              this.cursorY--;
              this.cursorX = prevLine.length;
            }
          }
          this.saveSnapshot(true);
          this.ensureCursorVisible();
          render();
          return;
        }

        if (key.name === "delete") {
          if (this.cursorX < currentLine.length) {
            this.lines[this.cursorY] =
              currentLine.slice(0, this.cursorX) +
              currentLine.slice(this.cursorX + 1);
          } else if (this.cursorY < this.lines.length - 1) {
            this.lines[this.cursorY] =
              currentLine + this.lines[this.cursorY + 1];
            this.lines.splice(this.cursorY + 1, 1);
          }
          this.saveSnapshot();
          render();
          return;
        }

        if (key.name === "up") {
          if (this.cursorY > 0) {
            this.cursorY--;
            this.cursorX = Math.min(
              this.cursorX,
              this.lines[this.cursorY].length,
            );
          }
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "down") {
          if (this.cursorY < this.lines.length - 1) {
            this.cursorY++;
            this.cursorX = Math.min(
              this.cursorX,
              this.lines[this.cursorY].length,
            );
          }
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "left") {
          if (this.cursorX > 0) {
            if (key.ctrl)
              this.cursorX = this.getWordStartLeft(currentLine, this.cursorX);
            else this.cursorX--;
          } else if (this.cursorY > 0) {
            this.cursorY--;
            this.cursorX = this.lines[this.cursorY].length;
          }
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "right") {
          if (this.cursorX < currentLine.length) {
            if (key.ctrl) {
              let i = this.cursorX;
              while (i < currentLine.length && currentLine[i] !== " ") i++;
              while (i < currentLine.length && currentLine[i] === " ") i++;
              this.cursorX = i;
            } else this.cursorX++;
          } else if (this.cursorY < this.lines.length - 1) {
            this.cursorY++;
            this.cursorX = 0;
          }
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "home") {
          this.cursorX = 0;
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "end") {
          this.cursorX = currentLine.length;
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "pageup") {
          this.cursorY = Math.max(0, this.cursorY - 10);
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "pagedown") {
          this.cursorY = Math.min(this.lines.length - 1, this.cursorY + 10);
          this.ensureCursorVisible();
          render();
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          const left = currentLine.slice(0, this.cursorX);
          const right = currentLine.slice(this.cursorX);
          this.lines[this.cursorY] = left;
          this.lines.splice(this.cursorY + 1, 0, right);
          this.cursorY++;
          this.cursorX = 0;
          this.saveSnapshot(true);
          this.ensureCursorVisible();
          render();
          return;
        }
        if (key.name === "tab") {
          this.lines[this.cursorY] =
            `${currentLine.slice(0, this.cursorX)}  ${currentLine.slice(this.cursorX)}`;
          this.cursorX += 2;
          this.saveSnapshot();
          render();
          return;
        }
        if (
          key.sequence &&
          key.sequence.length === 1 &&
          !key.ctrl &&
          !key.meta
        ) {
          this.lines[this.cursorY] =
            currentLine.slice(0, this.cursorX) +
            key.sequence +
            currentLine.slice(this.cursorX);
          this.cursorX++;
          this.saveSnapshot();
          this.ensureCursorVisible();
          render();
          return;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

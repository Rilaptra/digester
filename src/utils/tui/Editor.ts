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
  private cursorY = 0; // 0 means first line of CONTENT (exclude header)

  constructor(config: EditorConfig) {
    this.config = config;
    if (config.initialValue) {
      this.lines = config.initialValue.split("\n");
      this.cursorY = this.lines.length - 1;
      this.cursorX = this.lines[this.cursorY].length;
    }
  }

  public async run(): Promise<string> {
    const { stdin, stdout } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide Cursor awal

    const render = () => {
      // --- 1. RESET CURSOR KE HEADER (TOP LEFT) ---
      // Posisi cursorY saat ini adalah relative terhadap konten baris ke-0.
      // Header ada di atas baris ke-0.
      // Jadi total baris yang harus dinaiki = cursorY + 1 (Header).
      const rowsUp = this.cursorY + 1;

      if (rowsUp > 0) {
        stdout.write(`\x1B[${rowsUp}A`); // Move Up N lines
      }
      stdout.write("\r"); // Move to start of line

      // --- 2. CLEAR EVERYTHING DOWN ---
      // Sekarang kita ada di posisi Header paling kiri. Hapus semua ke bawah.
      stdout.write("\x1B[J");

      // --- 3. RENDER CONTENT ---
      // Render Header
      stdout.write(
        `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.dim("(Ctrl+S to save)")}\n`,
      );

      // Render Lines
      this.lines.forEach((line, idx) => {
        // Line number styling
        const lineNum = chalk.dim(
          `${(idx + 1).toString().padStart(2, " ")} | `,
        );

        let content = line;
        // Placeholder logic (cuma kalau kosong & di baris aktif)
        if (
          this.lines.length === 1 &&
          line.length === 0 &&
          this.config.placeholder
        ) {
          content = chalk.gray(this.config.placeholder);
        }

        // Kita print manual newline di akhir kecuali baris terakhir
        // (Tapi array join udah handle newline sih)
        // Hati-hati: console.log nambah newline otomatis, stdout.write enggak (kecuali kita kasih \n)
        stdout.write(`${lineNum}${content}\n`);
      });

      // --- 4. KEMBALIKAN KURSOR KE POSISI EDITING ---
      // Saat ini kursor terminal ada di baris paling bawah (setelah print baris terakhir).
      // Kita harus naikkan kursor ke baris this.cursorY.

      const totalContentLines = this.lines.length;
      // Header (1) + Content (N). Posisi sekarang di baris N+1.
      // Target posisi: Baris (cursorY + 1).
      // Jadi harus naik: (Total Lines yang baru diprint) - (Target Row Index)
      // Total output lines = 1 (header) + this.lines.length.
      // Current logical index = this.lines.length (karena abis newline terakhir).
      // Target logical index = 1 + cursorY.

      // Rumus Naik: (Jumlah baris konten) - cursorY
      const linesToMoveUp = totalContentLines - this.cursorY;

      if (linesToMoveUp > 0) {
        stdout.write(`\x1B[${linesToMoveUp}A`);
      }

      // Geser Kanan (Indentasi Line Number + cursorX)
      // " 1 | " = 5 chars
      const prefixLen = 5;
      const visualX = prefixLen + this.cursorX;
      stdout.write(`\r\x1B[${visualX}C`);

      stdout.write("\x1B[?25h"); // Show Cursor biar user tau posisi ngetik
    };

    render();

    return new Promise((resolve) => {
      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string },
      ) => {
        // SAVE (Ctrl+S / Ctrl+D)
        if (key.ctrl && (key.name === "s" || key.name === "d")) {
          cleanup();
          resolve(this.lines.join("\n"));
          return;
        }

        // CANCEL (Ctrl+C)
        if (key.ctrl && key.name === "c") {
          stdout.write("\n");
          process.exit(0);
        }

        const currentLine = this.lines[this.cursorY];

        // --- NAVIGATION & EDITING ---
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
            if (this.cursorX > 0) {
              this.cursorX--;
              render();
            } else if (this.cursorY > 0) {
              // Wrap ke akhir baris atas
              this.cursorY--;
              this.cursorX = this.lines[this.cursorY].length;
              render();
            }
            break;
          case "right":
            if (this.cursorX < currentLine.length) {
              this.cursorX++;
              render();
            } else if (this.cursorY < this.lines.length - 1) {
              // Wrap ke awal baris bawah
              this.cursorY++;
              this.cursorX = 0;
              render();
            }
            break;

          case "return":
          case "enter": {
            // Split line di posisi kursor
            const left = currentLine.slice(0, this.cursorX);
            const right = currentLine.slice(this.cursorX);

            this.lines[this.cursorY] = left;
            this.lines.splice(this.cursorY + 1, 0, right);

            this.cursorY++;
            this.cursorX = 0;
            render();
            break;
          }

          case "backspace": {
            if (this.cursorX > 0) {
              // Hapus karakter biasa
              const newLine =
                currentLine.slice(0, this.cursorX - 1) +
                currentLine.slice(this.cursorX);
              this.lines[this.cursorY] = newLine;
              this.cursorX--;
              render();
            } else if (this.cursorY > 0) {
              // Merge baris ini ke baris atas
              const prevLine = this.lines[this.cursorY - 1];
              const currentLen = prevLine.length;

              this.lines[this.cursorY - 1] = prevLine + currentLine;
              this.lines.splice(this.cursorY, 1); // Hapus baris sekarang

              this.cursorY--;
              this.cursorX = currentLen;
              render();
            }
            break;
          }

          default:
            if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
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

      const cleanup = () => {
        // Pindahkan kursor ke paling bawah dari area yang sudah dirender
        // Total height = Header(1) + Lines
        // Posisi sekarang (cursorY relative to content)
        // Move Down = (Lines - cursorY)
        const linesDown = this.lines.length - this.cursorY;
        if (linesDown > 0) stdout.write(`\x1B[${linesDown}B`);

        stdout.write("\r\n"); // Newline final

        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);

        // Final Clean Log (Clear UI Editor, ganti jadi summary)
        // UI Height = 1 (Header) + N (Lines)
        const uiHeight = 1 + this.lines.length;
        stdout.write(`\x1B[${uiHeight}A`); // Naik ke atas UI
        stdout.write("\x1B[J"); // Hapus UI

        const content = this.lines.join("\n");
        // Print one-line summary
        const preview =
          content.length > 50
            ? `${content.substring(0, 50).replace(/\n/g, " ")}...`
            : content.replace(/\n/g, "⏎ ");
        stdout.write(
          `${chalk.cyan("? ")} ${chalk.bold(this.config.title)} ${chalk.green(preview)}\n`,
        );
      };

      stdin.on("keypress", handleKey);
    });
  }
}

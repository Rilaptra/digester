import { spawn } from "node:child_process"; // Bun.spawn is async, for openFile we often want fire-and-forget or specific detach
import { existsSync } from "node:fs"; // Bun.file().exists() is async, keep sync for simple checks if needed, but prefer async where possible
import { isAbsolute, resolve } from "node:path";
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";
import { generateLog } from "./logger.js";

/**
 * Format bytes to human readable string
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${["B", "KB", "MB", "GB"][i]}`;
}

/**
 * Estimate token count from bytes (rough approximation)
 */
export function estimateTokens(bytes: number): string {
  const tokens = Math.ceil(bytes / 2); // Rule of thumb: 1 token ~ 4 chars, but code often has more tokens per byte. 2 is safe conservative.
  if (tokens > 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
}

/**
 * Open a file or directory in the default system application
 */
export function openFile(path: string) {
  const cmd = process.platform === "win32" ? "explorer" : "open";
  // specific logic for windows/mac to open file explorer
  spawn(cmd, [path], { stdio: "ignore", detached: true }).unref();
}

/**
 * Resolve a path to an absolute path, checking existence in CWD or parent
 */
export function resolvePath(input: string): string | null {
  // 1. Check if absolute
  if (isAbsolute(input)) return existsSync(input) ? input : null;

  // 2. Check relative to CWD
  let p = resolve(process.cwd(), input);
  if (existsSync(p)) return p;

  // 3. Check level up (useful if inside a subdir)
  p = resolve(process.cwd(), "..", input);
  if (existsSync(p)) return p;

  return null;
}

/**
 * Prompts user for Yes/No input
 */
export async function promptYesNo(question: string): Promise<boolean> {
  process.stdout.write(question);
  // Bun has no process.stdin.setRawMode directly exposed easily consistent across envs?
  // Node compat layer works.
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
      resolve(key !== "n");
    });
  });
}

/**
 * Prompts user to select multiple from a list
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
 * Prompts user to select from a list
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

// --- src/utils/index.ts ---
// ... imports (emitKeypressEvents, chalk, generateLog, dll) ...

/**
 * Interactive Select Menu V2 (Grid Support + 4-Way Nav)
 * @param columns Number of columns (default: 1). Use 2 or 3 for compact view.
 */
export async function promptSelectV2(
  question: string,
  options: string[],
  config: {
    allowCustom?: boolean;
    columns?: number; // 🔥 Fitur Baru: Tentukan jumlah kolom
  } = {},
): Promise<string> {
  const { allowCustom = false, columns = 1 } = config;

  // Prep Options
  const choices = allowCustom ? [...options, "Other..."] : options;
  let index = 0;

  // 📐 Layout Calculation
  // Hitung panjang string terpanjang untuk nentuin lebar kolom
  const maxLabelLength = Math.max(...choices.map((c) => c.length));
  // Tambah buffer untuk pointer (❯ ) dan spasi antar kolom
  const colWidth = maxLabelLength + 5;
  // Hitung total baris yang dibutuhkan
  const totalRows = Math.ceil(choices.length / columns);

  // Setup Raw Mode
  if (process.stdin.setRawMode) process.stdin.setRawMode(true);
  process.stdin.resume();
  emitKeypressEvents(process.stdin);

  process.stdout.write("\x1B[?25l"); // Hide Cursor

  // --- RENDER FUNCTION ---
  const render = (firstRender = false) => {
    if (!firstRender) {
      // Clear previous lines (Jumlah baris + 1 title)
      process.stdout.write(`\x1B[${totalRows + 1}A`);
    }

    process.stdout.write(`${chalk.cyan(`? ${question}`)}\n`);

    // Loop per Baris
    for (let row = 0; row < totalRows; row++) {
      let lineOutput = "";

      // Loop per Kolom di baris tersebut
      for (let col = 0; col < columns; col++) {
        const itemIndex = row * columns + col; // Rumus konversi Grid ke Array Flat

        if (itemIndex < choices.length) {
          const isSelected = itemIndex === index;
          const label = choices[itemIndex];

          // Pointer logic
          const pointer = isSelected ? chalk.cyan("❯") : " ";

          // Text styling
          const text = isSelected ? chalk.cyan.bold(label) : chalk.dim(label);

          // 🔥 PADDING MAGIC
          // Kita harus hitung 'visual length' tanpa ANSI codes buat padding yang pas
          // Tapi cara simpel: padEnd string aslinya DULU sebelum dikasih warna
          // ATAU (Better): Print fixed width block.

          // Trik hemat: manual spacing padding
          const padding = " ".repeat(colWidth - label.length - 2);

          lineOutput += `${pointer} ${text}${padding}`;
        }
      }
      // Print baris ini lalu clear sisa line ke kanan (\x1B[K)
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

      // --- LOGIKA NAVIGASI GRID ---
      switch (key.name) {
        case "left":
          // Mundur 1 (Wrap ke akhir list jika di awal)
          index = (index - 1 + choices.length) % choices.length;
          render();
          break;

        case "right":
          // Maju 1 (Wrap ke awal list jika di akhir)
          index = (index + 1) % choices.length;
          render();
          break;

        case "up":
          // Lompat ke atas (Kurangi index sebanyak jumlah kolom)
          if (index - columns >= 0) {
            index -= columns;
          } else {
            // Kalau di baris paling atas, wrap ke elemen paling bawah di kolom yang sama (optional)
            // Atau logic simple: wrap ke paling bawah index terakhir
            const target = index + (totalRows - 1) * columns;
            index = target < choices.length ? target : target - columns;
            // Fallback kalau loncatnya kejauhan (karena baris terakhir gak penuh)
            if (index >= choices.length) index = choices.length - 1;
          }
          render();
          break;

        case "down":
          // Lompat ke bawah (Tambah index sebanyak jumlah kolom)
          if (index + columns < choices.length) {
            index += columns;
          } else {
            // Kalau di baris paling bawah, wrap ke atas (index % columns)
            index = index % columns;
          }
          render();
          break;

        case "return":
        case "enter": {
          process.stdin.removeListener("keypress", handleKey);
          if (process.stdin.setRawMode) process.stdin.setRawMode(false);
          process.stdin.pause();

          // Cleanup UI
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
 * Prompts user for text input
 */
export async function promptText(question: string): Promise<string> {
  const answer = await new Promise<string>((resolve) => {
    process.stdout.write(question);

    // Ensure we are in "cooked" mode for text input?
    // Actually promptSelect puts us in raw mode sometimes.
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

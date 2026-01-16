// --- src/utils/tui/Select.ts ---
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

// --- TYPES ---

/**
 * A function that resolves the color/style of a specific option text.
 * @param {string} text - The text to colorize.
 * @returns {string} The colorized text with ANSI codes.
 */
export type ColorResolver = (text: string) => string;

/**
 * Represents a single option within the Select menu.
 * @template ValueType The type of the value associated with the option.
 */
export interface SelectOption<ValueType> {
  /** The display label for the option. */
  label: string;
  /** The underlying value associated with the option. */
  value: ValueType;
  /** Optional description text displayed alongside the option (usually in single-column mode). */
  description?: string;
  /** Optional custom icon to replace the default selection circle. */
  icon?: string;
  /** Optional custom color resolver for this specific option. */
  color?: ColorResolver;
  /** If true, the option cannot be selected and will be skipped during navigation. */
  disabled?: boolean;
}

/**
 * Configuration options for the Select prompt.
 */
export interface SelectConfig {
  /** The title or question to display above the menu. */
  title?: string;
  /** The number of columns to display. Default is 1. */
  columns?: number;
  /** Whether to clear the menu output after a selection is made. Default is true. */
  clearOnSubmit?: boolean;
  /** The maximum number of items visible at once (pagination limit). Default is 7. */
  pageSize?: number;
}

// --- CLASS DEFINITION ---

/**
 * A highly flexible, interactive single-select CLI prompt.
 * Supports grid selection, pagination, custom icons, descriptions, and dynamic coloring.
 *
 * @template ValueType The type of the value returned by the prompt. Default is string.
 *
 * @example
 * ```typescript
 * const color = await new Select<string>()
 *   .title("Choose a color")
 *   .add("Red", "#ff0000", { desc: "Bright and bold" })
 *   .add("Blue", "#0000ff", { desc: "Calm and deep" })
 *   .run();
 * ```
 */
export class Select<ValueType = string> {
  private options: SelectOption<ValueType>[] = [];
  private config: SelectConfig = {
    columns: 1,
    clearOnSubmit: true,
    pageSize: 7, // Default 7 baris biar compact di layar kecil
  };
  private selectedIndex = 0;
  private scrollOffset = 0; // 🔥 Track baris paling atas yg kelihatan

  /**
   * Creates a new Select prompt instance.
   * @param {SelectConfig} [config] - Initial configuration.
   */
  constructor(config?: SelectConfig) {
    if (config) this.config = { ...this.config, ...config };
  }

  // --- 🛠️ BUILDER METHODS ---

  /**
   * Sets the title/question of the prompt.
   * @param {string} text - The title text.
   * @returns {this} The current instance for chaining.
   */
  public title(text: string): this {
    this.config.title = text;
    return this;
  }

  /**
   * Sets the number of columns for the layout.
   * @param {number} count - Number of columns (e.g., 2, 3).
   * @returns {this} The current instance for chaining.
   */
  public columns(count: number): this {
    this.config.columns = count;
    return this;
  }

  /**
   * Sets the page size (pagination limit) for the menu.
   * @param {number} count - Max number of rows visible.
   * @returns {this} The current instance for chaining.
   */
  public pageSize(count: number): this {
    this.config.pageSize = count;
    return this;
  }

  /**
   * Adds an option to the select menu.
   *
   * @param {string} label - The display label.
   * @param {ValueType} value - The value to return if selected.
   * @param {Object} [meta] - Additional metadata for the option.
   * @param {string} [meta.desc] - Description text.
   * @param {string} [meta.icon] - Custom icon.
   * @param {ColorResolver} [meta.color] - Custom color function.
   * @param {boolean} [meta.disabled] - Whether the option is disabled.
   * @returns {this} The current instance for chaining.
   */
  public add(
    label: string,
    value: ValueType,
    meta?: {
      desc?: string;
      icon?: string;
      color?: ColorResolver;
      disabled?: boolean;
    },
  ): this {
    this.options.push({
      label,
      value,
      description: meta?.desc,
      icon: meta?.icon,
      color: meta?.color,
      disabled: meta?.disabled,
    });
    return this;
  }

  /**
   * Adds a visual separator (non-selectable).
   *
   * @param {string} [label="──────────────"] - The visual separator string.
   * @returns {this} The current instance for chaining.
   */
  public separator(label = "──────────────"): this {
    this.options.push({
      label,
      value: null as unknown as ValueType,
      disabled: true,
      color: chalk.dim,
    });
    return this;
  }

  // --- 🚀 RUNNER ENGINE ---

  /**
   * Starts the interactive prompt and waits for user input.
   *
   * @returns {Promise<ValueType>} A promise that resolves to the selected value.
   * @throws {Error} If no options are provided.
   */
  public async run(): Promise<ValueType> {
    if (this.options.length === 0) {
      throw new Error("Select: No options provided!");
    }

    this.ensureValidSelection();

    const { stdin, stdout } = process;
    const columns = this.config.columns || 1;
    // Total baris nyata (data)
    const totalDataRows = Math.ceil(this.options.length / columns);
    // Tinggi viewport (pagination)
    const viewportHeight = this.config.pageSize || 7;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide Cursor

    let isFirstRender = true;

    const render = () => {
      // 1. Hitung Row index dari item yang dipilih saat ini
      const currentRow = Math.floor(this.selectedIndex / columns);

      // 2. Logic Auto-Scroll (Geser jendela viewport)
      // Kalau cursor di atas jendela -> geser jendela ke atas
      if (currentRow < this.scrollOffset) {
        this.scrollOffset = currentRow;
      }
      // Kalau cursor di bawah jendela -> geser jendela ke bawah
      else if (currentRow >= this.scrollOffset + viewportHeight) {
        this.scrollOffset = currentRow - viewportHeight + 1;
      }

      // Pastikan offset valid (misal abis wrap around)
      this.scrollOffset = Math.max(
        0,
        Math.min(this.scrollOffset, totalDataRows - viewportHeight),
      );

      // Khusus kalau total baris lebih dikit dari viewport, offset harus 0
      if (totalDataRows <= viewportHeight) this.scrollOffset = 0;

      // 3. Cleanup Render Sebelumnya
      // Kita hapus setinggi viewport + 1 (title) + 1 (footer indicator/padding)
      const heightToClear = viewportHeight + 2;
      if (!isFirstRender) {
        stdout.write(`\x1B[${heightToClear}A`); // Move Up
      }

      // 4. Render Title
      const titleStr = this.config.title
        ? `${chalk.cyan("? ")} ${chalk.bold(this.config.title)}`
        : chalk.cyan("? Select an option:");

      // Info Pagination (Current/Total)
      const progressStr =
        totalDataRows > viewportHeight
          ? chalk.dim(
              ` (${this.scrollOffset + 1}-${Math.min(
                this.scrollOffset + viewportHeight,
                totalDataRows,
              )}/${totalDataRows})`,
            )
          : "";

      stdout.write(`${titleStr}${progressStr}\x1B[K\n`);

      const maxLabelLen = Math.max(...this.options.map((o) => o.label.length));
      const colWidth = maxLabelLen + 6;

      // 5. Render Viewport Rows
      // Loop fix sebanyak `viewportHeight` biar tinggi output stabil (anti-glitch)
      for (let i = 0; i < viewportHeight; i++) {
        const row = this.scrollOffset + i;
        let lineOutput = "";

        if (row < totalDataRows) {
          // Render Kolom
          for (let col = 0; col < columns; col++) {
            const idx = row * columns + col;

            if (idx < this.options.length) {
              const opt = this.options[idx];
              const isSelected = idx === this.selectedIndex;

              const fallbackIcon = opt.disabled
                ? opt.label.includes("─")
                  ? ""
                  : "🔒"
                : isSelected
                  ? "●"
                  : "○";
              const finalIcon = opt.icon || fallbackIcon;

              const colorFn = opt.disabled
                ? chalk.gray
                : opt.color || (isSelected ? chalk.cyan.bold : chalk.white);

              const pointer = isSelected ? chalk.cyan("❯") : " ";
              const styledLabel = colorFn(opt.label);

              let content = `${pointer} ${finalIcon} ${styledLabel}`;

              if (columns === 1 && opt.description && !opt.disabled) {
                content += chalk.dim(` - ${opt.description}`);
              }

              if (columns > 1) {
                const rawLen = 2 + 2 + opt.label.length; // pointer + icon + label
                // Padding biar grid rapi
                const padding = " ".repeat(Math.max(1, colWidth - rawLen));
                content += padding;
              }

              lineOutput += content;
            }
          }
        } else {
          // Kalau baris ini kosong (karena data habis tapi viewport masih ada sisa)
          // Print empty line biar cursor position tetep konsisten
          lineOutput = chalk.dim(" ");
        }

        // Scrollbar Indicator di ujung kanan
        // let scrollBar = " ";
        // if (totalDataRows > viewportHeight) {
        //   if (row === this.scrollOffset && this.scrollOffset > 0)
        //     scrollBar = "▲";
        //   else if (
        //     row === this.scrollOffset + viewportHeight - 1 &&
        //     this.scrollOffset + viewportHeight < totalDataRows
        //   )
        //     scrollBar = "▼";
        //   else {
        //     // Simple position indicator
        //     // const isThumb = row >= this.scrollOffset && row < this.scrollOffset + viewportHeight; // Logic bar biasa
        //     // scrollBar = isThumb ? "│" : " ";
        //     scrollBar = "│"; // Just a border line
        //   }
        // }

        stdout.write(` ${lineOutput}\x1B[K\n`);
      }

      // 6. Bottom Padding/Indicator (Optional, buat visual breathing room)
      stdout.write(`${chalk.dim("─".repeat(10))}\x1B[K\n`);

      isFirstRender = false;
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        stdout.write("\x1B[?25h");
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
      };

      const handleKey = (_: unknown, key: { name: string; ctrl: boolean }) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          stdout.write("\n");
          process.exit(0);
        }

        const prevIndex = this.selectedIndex;

        switch (key.name) {
          case "up":
            this.moveSelection(-columns);
            break;
          case "down":
            this.moveSelection(columns);
            break;
          case "left":
            this.moveSelection(-1);
            break;
          case "right":
            this.moveSelection(1);
            break;
          case "pageup": // 🔥 Bonus Navigation
            this.moveSelection(-(columns * viewportHeight));
            break;
          case "pagedown": // 🔥 Bonus Navigation
            this.moveSelection(columns * viewportHeight);
            break;
          case "return":
          case "enter": {
            const selected = this.options[this.selectedIndex];
            if (selected.disabled) return;

            cleanup();

            // Clear area render
            if (this.config.clearOnSubmit) {
              const heightToClear = viewportHeight + 2;
              stdout.write(`\x1B[${heightToClear}A`);
              stdout.write(`\x1B[0J`);
            }

            const icon = selected.icon || "✔";
            const finalLog = `${chalk.cyan("? ")} ${chalk.bold(
              this.config.title || "Select",
            )} ${chalk.green(`${icon} ${selected.label}`)}\n`;
            stdout.write(finalLog);

            resolve(selected.value);
            return;
          }
        }

        if (prevIndex !== this.selectedIndex) render();
      };

      stdin.on("keypress", handleKey);
    });
  }

  private moveSelection(step: number) {
    const len = this.options.length;
    let newIndex = this.selectedIndex;
    let attempts = 0;

    // Logic wrapping yang lebih aman
    do {
      newIndex = newIndex + step;

      // Handle Wrap Around
      if (newIndex < 0) {
        // Kalau scroll ke atas mentok, pindah ke paling bawah
        // Cari item valid paling bawah
        newIndex = len - 1;
        // Adjust biar align kolomnya enak (optional, tapi simple wrap is better)
      } else if (newIndex >= len) {
        newIndex = 0;
      }

      attempts++;
    } while (this.options[newIndex].disabled && attempts < len);

    if (attempts < len) {
      this.selectedIndex = newIndex;
    }
  }

  private ensureValidSelection() {
    if (this.options[this.selectedIndex].disabled) {
      this.moveSelection(1);
    }
  }
}

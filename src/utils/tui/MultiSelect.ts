// --- src/utils/tui/MultiSelect.ts ---
/** biome-ignore-all lint/suspicious/noControlCharactersInRegex: <explanation:  is a control character> */
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

// --- TYPES ---
/**
 * Represents a single option within the MultiSelect menu.
 * @template ValueType The type of the value associated with the option.
 */
export interface MultiSelectOption<ValueType> {
  /** The display label for the option. */
  label: string;
  /** The underlying value associated with the option. */
  value: ValueType;
  /** Optional description text displayed alongside the option. */
  description?: string;
  /** If true, the option cannot be selected or deselected. */
  disabled?: boolean;
}

/**
 * Configuration options for the MultiSelect prompt.
 */
export interface MultiSelectConfig {
  /** The title or question to display above the menu. */
  title?: string;
  /** The number of columns to display. Default is 1. */
  columns?: number;
  /** Whether to clear the menu output after submission. Default is true. */
  clearOnSubmit?: boolean;
  /** The maximum number of items visible at once. Default is 7. */
  pageSize?: number;
  /** Minimum number of items that must be selected before submission. */
  minSelect?: number;
}

// --- CLASS DEFINITION ---

/**
 * An interactive multi-select CLI prompt.
 * Features grid layout, pagination, min-selection validation, and keyboard navigation.
 *
 * @template ValueType The type of the values returned. Default is string.
 */
export class MultiSelect<ValueType = string> {
  private options: MultiSelectOption<ValueType>[] = [];
  private config: MultiSelectConfig = {
    columns: 1,
    clearOnSubmit: true,
    pageSize: 7,
    minSelect: 0,
  };
  private selectedIndices = new Set<number>();
  private focusedIndex = 0;
  private scrollOffset = 0;

  /**
   * Creates a new MultiSelect prompt instance.
   * @param {MultiSelectConfig} [config] - Initial configuration.
   */
  constructor(config?: MultiSelectConfig) {
    if (config) this.config = { ...this.config, ...config };
  }

  // --- BUILDER METHODS ---

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
   * @param {number} count - Number of columns.
   * @returns {this} The current instance for chaining.
   */
  public columns(count: number): this {
    this.config.columns = count;
    return this;
  }

  /**
   * Sets the page size (max visible rows).
   * @param {number} count - Page size.
   * @returns {this} The current instance for chaining.
   */
  public pageSize(count: number): this {
    this.config.pageSize = count;
    return this;
  }

  /**
   * Sets the minimum number of items that must be selected.
   * @param {number} count - Minimum count.
   * @returns {this} The current instance for chaining.
   */
  public minSelect(count: number): this {
    this.config.minSelect = count;
    return this;
  }

  /**
   * Adds an option to the multi-select menu.
   *
   * @param {string} label - The display label.
   * @param {ValueType} value - The value to return if selected.
   * @param {Object} [meta] - Additional metadata.
   * @param {string} [meta.desc] - Description text.
   * @param {boolean} [meta.disabled] - Whether the option is disabled.
   * @param {boolean} [meta.selected] - Whether the option is pre-selected.
   * @returns {this} The current instance for chaining.
   */
  public add(
    label: string,
    value: ValueType,
    meta?: { desc?: string; disabled?: boolean; selected?: boolean },
  ): this {
    const idx = this.options.length;
    this.options.push({
      label,
      value,
      description: meta?.desc,
      disabled: meta?.disabled,
    });
    if (meta?.selected) {
      this.selectedIndices.add(idx);
    }
    return this;
  }

  // --- RUNNER ---

  /**
   * Starts the interactive prompt and waits for user input.
   *
   * @returns {Promise<ValueType[]>} A promise that resolves to an array of selected values.
   * @throws {Error} If no options are provided.
   */
  public async run(): Promise<ValueType[]> {
    if (this.options.length === 0) {
      throw new Error("MultiSelect: No options provided!");
    }

    const { stdin, stdout } = process;
    const columns = this.config.columns || 1;
    const totalDataRows = Math.ceil(this.options.length / columns);
    const viewportHeight = this.config.pageSize || 7;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide Cursor

    let isFirstRender = true;
    let errorMessage = "";

    const render = () => {
      // 1. Scroll Logic
      const currentRow = Math.floor(this.focusedIndex / columns);
      if (currentRow < this.scrollOffset) {
        this.scrollOffset = currentRow;
      } else if (currentRow >= this.scrollOffset + viewportHeight) {
        this.scrollOffset = currentRow - viewportHeight + 1;
      }
      this.scrollOffset = Math.max(
        0,
        Math.min(this.scrollOffset, totalDataRows - viewportHeight),
      );
      if (totalDataRows <= viewportHeight) this.scrollOffset = 0;

      // 2. Clear Area
      const totalRenderedLines = viewportHeight + 2;
      if (!isFirstRender) {
        stdout.write(`\x1B[${totalRenderedLines}A`);
      }

      // 3. Render Header
      const count = this.selectedIndices.size;
      const titleStr = this.config.title
        ? `${chalk.cyan("? ")} ${chalk.bold(this.config.title)}`
        : chalk.cyan("? Select options:");

      const selectionInfo =
        count > 0
          ? chalk.green(` (${count} selected)`)
          : chalk.dim(" (0 selected)");

      stdout.write(`${titleStr}${selectionInfo}\x1B[K\n`);

      // 4. Calculate Column Width Dynamically
      // Cari label terpanjang
      const maxLabelLen = Math.max(...this.options.map((o) => o.label.length));
      // Base width = Pointer(2) + Icon(2) + Spasi(1) + Label + Padding(2)
      // Kita set minimum width biar ga mepet banget
      const colWidth = maxLabelLen + 7;

      // 5. Render Viewport Loops
      for (let i = 0; i < viewportHeight; i++) {
        const row = this.scrollOffset + i;
        let lineOutput = "";

        // Loop Kolom
        for (let col = 0; col < columns; col++) {
          const idx = row * columns + col;

          // Apakah slot ini ada isinya (item)?
          if (row < totalDataRows && idx < this.options.length) {
            const opt = this.options[idx];
            const isFocused = idx === this.focusedIndex;
            const isSelected = this.selectedIndices.has(idx);

            // --- Construct Content ---
            // Pointer: "❯ " (2 chars) atau "  "
            const pointer = isFocused ? chalk.cyan("❯ ") : "  ";

            // Icon: "○" / "●" / "🔒"
            let iconStr = isSelected ? "●" : "○";
            if (opt.disabled) iconStr = "🔒";

            // Warnai Icon
            let icon = isSelected ? chalk.green(iconStr) : chalk.dim(iconStr);
            if (opt.disabled) icon = chalk.dim(iconStr);

            // Label Style
            let styledLabel = opt.label;
            if (opt.disabled) styledLabel = chalk.gray(opt.label);
            else if (isFocused) styledLabel = chalk.cyan.bold(opt.label);
            else if (isSelected) styledLabel = chalk.green(opt.label);
            else styledLabel = chalk.white(opt.label);

            // Gabung string visual (tanpa padding dulu)
            const visualContent = `${pointer}${icon} ${styledLabel}`;

            // Hitung panjang string asli (tanpa kode warna) untuk padding
            // Pointer(2) + Icon(1/2) + Space(1) + Label
            // Kita pakai string raw dari pointer+iconStr+space+label untuk hitung length
            const rawStringCheck = `  ${iconStr} ${opt.label}`;
            // Note: Kita pake 2 spasi buat simulasi pointer length

            const currentLen = rawStringCheck.length;
            const paddingNeeded = Math.max(1, colWidth - currentLen);
            const padding = " ".repeat(paddingNeeded);

            lineOutput += visualContent + padding;

            // Description (Cuma kalau 1 kolom, kalau grid jadi berantakan)
            if (columns === 1 && opt.description && !opt.disabled) {
              // Hapus padding yg tadi, ganti logic
              lineOutput = `${lineOutput.trimEnd()} ${chalk.dim(`- ${opt.description}`)}`;
            }
          } else {
            // 🔥 FIX: EMPTY SLOT PADDING
            // Kalau slot ini kosong (misal baris terakhir cuma ada 2 item dari 3 kolom),
            // kita WAJIB isi dengan spasi kosong seukuran colWidth
            // biar scrollbar di ujung kanan ga geser kiri.
            lineOutput += " ".repeat(colWidth);
          }
        }

        // Scrollbar Indicator (Di Ujung Kanan)
        let scrollBar = " ";
        if (totalDataRows > viewportHeight) {
          if (row === this.scrollOffset && this.scrollOffset > 0)
            scrollBar = "▲";
          else if (
            row === this.scrollOffset + viewportHeight - 1 &&
            this.scrollOffset + viewportHeight < totalDataRows
          )
            scrollBar = "▼";
          else scrollBar = "│";
        }

        stdout.write(`${lineOutput}${chalk.dim(scrollBar)}\x1B[K\n`);
      }

      // 6. Footer
      if (errorMessage) {
        stdout.write(`${chalk.red(` ⚠ ${errorMessage}`)}\x1B[K\n`);
      } else {
        stdout.write(
          chalk.dim(" (Press <space> to select, <enter> to complete)") +
            "\x1B[K\n",
        );
      }

      isFirstRender = false;
    };

    render();

    return new Promise((resolve) => {
      const handleKey = (_: unknown, key: { name: string; ctrl: boolean }) => {
        if (errorMessage) {
          errorMessage = "";
          render();
          return;
        }

        if (key.ctrl && key.name === "c") {
          stdout.write("\x1B[?25h");
          stdout.write("\n");
          process.exit(0);
        }

        switch (key.name) {
          case "up":
            this.moveFocus(-columns);
            render();
            break;
          case "down":
            this.moveFocus(columns);
            render();
            break;
          case "left":
            this.moveFocus(-1);
            render();
            break;
          case "right":
            this.moveFocus(1);
            render();
            break;
          case "pageup":
            this.moveFocus(-(columns * viewportHeight));
            render();
            break;
          case "pagedown":
            this.moveFocus(columns * viewportHeight);
            render();
            break;
          case "space": {
            const opt = this.options[this.focusedIndex];
            if (!opt.disabled) {
              if (this.selectedIndices.has(this.focusedIndex)) {
                this.selectedIndices.delete(this.focusedIndex);
              } else {
                this.selectedIndices.add(this.focusedIndex);
              }
              render();
            }
            break;
          }
          case "return":
          case "enter": {
            if (
              this.config.minSelect &&
              this.selectedIndices.size < this.config.minSelect
            ) {
              errorMessage = `You must select at least ${this.config.minSelect} items.`;
              render();
              return;
            }

            // Cleanup
            stdout.write("\x1B[?25h");
            if (stdin.setRawMode) stdin.setRawMode(false);
            stdin.pause();
            stdin.removeListener("keypress", handleKey);

            if (this.config.clearOnSubmit) {
              const totalRenderedLines = viewportHeight + 2;
              stdout.write(`\x1B[${totalRenderedLines}A`);
              stdout.write(`\x1B[0J`);
            }

            const results = this.options
              .filter((_, idx) => this.selectedIndices.has(idx))
              .map((o) => o.value);

            const title = this.config.title || "Selected";
            const preview =
              results.length > 0
                ? chalk.green(results.join(", "))
                : chalk.dim("None");

            stdout.write(
              `${chalk.cyan("? ")} ${chalk.bold(title)} ${preview}\n`,
            );

            resolve(results);
            break;
          }
        }
      };

      stdin.on("keypress", handleKey);
    });
  }

  private moveFocus(step: number) {
    const len = this.options.length;
    let newIndex = this.focusedIndex;
    let attempts = 0;

    do {
      newIndex = newIndex + step;
      if (newIndex < 0) newIndex = len - 1;
      else if (newIndex >= len) newIndex = 0;
      attempts++;
    } while (this.options[newIndex].disabled && attempts < len);

    if (attempts < len) {
      this.focusedIndex = newIndex;
    }
  }
}

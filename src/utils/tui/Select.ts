import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

// --- TYPES ---

export type ColorResolver = (text: string) => string;

export interface SelectOption<ValueType> {
  label: string;
  value: ValueType;
  description?: string;
  icon?: string;
  color?: ColorResolver;
  disabled?: boolean;
}

export interface SelectConfig {
  title?: string;
  columns?: number;
  clearOnSubmit?: boolean;
}

// --- CLASS DEFINITION ---

export class Select<ValueType = string> {
  private options: SelectOption<ValueType>[] = [];
  private config: SelectConfig = { columns: 1, clearOnSubmit: true };
  private selectedIndex = 0;

  constructor(config?: SelectConfig) {
    if (config) this.config = { ...this.config, ...config };
  }

  // --- 🛠️ BUILDER METHODS ---

  public title(text: string): this {
    this.config.title = text;
    return this;
  }

  public columns(count: number): this {
    this.config.columns = count;
    return this;
  }

  public add(
    label: string,
    value: ValueType,
    meta?: {
      desc?: string;
      icon?: string;
      color?: ColorResolver;
      disabled?: boolean;
    }
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

  public async run(): Promise<ValueType> {
    if (this.options.length === 0) {
      throw new Error("Select: No options provided!");
    }

    this.ensureValidSelection();

    const { stdin, stdout } = process;
    const columns = this.config.columns || 1;
    const totalRows = Math.ceil(this.options.length / columns);

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide Cursor

    let isFirstRender = true;

    const render = () => {
      if (!isFirstRender) {
        stdout.write(`\x1B[${totalRows + 1}A`);
      }

      const titleStr = this.config.title
        ? `${chalk.cyan("? ")} ${chalk.bold(this.config.title)}`
        : chalk.cyan("? Select an option:");
      stdout.write(`${titleStr}\x1B[K\n`);

      const maxLabelLen = Math.max(...this.options.map((o) => o.label.length));
      const colWidth = maxLabelLen + 6;

      for (let row = 0; row < totalRows; row++) {
        let lineOutput = "";

        for (let col = 0; col < columns; col++) {
          const idx = row * columns + col;

          if (idx < this.options.length) {
            const opt = this.options[idx];
            const isSelected = idx === this.selectedIndex;

            // 🔥 FIXED LOGIC HERE 🔥
            // Prioritas: Icon User > Gembok (jika disabled & ga ada icon user) > Dot
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
              const rawLen = 2 + 2 + opt.label.length;
              const padding = " ".repeat(Math.max(1, colWidth - rawLen));
              content += padding;
            }

            lineOutput += content;
          }
        }
        stdout.write(` ${lineOutput}\x1B[K\n`);
      }

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
          case "return":
          case "enter": {
            const selected = this.options[this.selectedIndex];
            if (selected.disabled) return;

            cleanup();

            if (this.config.clearOnSubmit) {
              stdout.write(`\x1B[${totalRows + 1}A`);
              stdout.write(`\x1B[0J`);
            }

            const icon = selected.icon || "✔";
            // Pastikan result log-nya bersih
            const finalLog = `${chalk.cyan("? ")} ${chalk.bold(
              this.config.title || "Select"
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
    do {
      newIndex = (newIndex + step + len) % len;
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

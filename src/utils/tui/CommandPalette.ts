import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

export interface PaletteItem {
  label: string;
  value: string;
  description?: string;
  icon?: string;
}

export class CommandPalette {
  private items: PaletteItem[] = [];
  private filtered: PaletteItem[] = [];
  private query = "";
  private selectedIndex = 0;
  private title: string;

  constructor(title: string, items: PaletteItem[]) {
    this.title = title;
    this.items = items;
    this.filtered = items;
  }

  public async run(): Promise<string | null> {
    const { stdin, stdout } = process;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l"); // Hide cursor

    const render = () => {
      stdout.write("\x1B[2J\x1B[H"); // Clear screen
      stdout.write(
        `${chalk.cyan("?")} ${chalk.bold(this.title)} ${chalk.dim("(type to filter, esc to cancel)")}\n`,
      );
      stdout.write(`${chalk.cyan(">")} ${this.query}\n\n`);

      const limit = Math.min(10, this.filtered.length);
      for (let i = 0; i < limit; i++) {
        const item = this.filtered[i];
        const isSelected = i === this.selectedIndex;
        const icon = item.icon || "📄";
        const label = isSelected
          ? chalk.cyan.bold(item.label)
          : chalk.white(item.label);
        const desc = item.description
          ? chalk.dim(` - ${item.description}`)
          : "";
        const pointer = isSelected ? chalk.cyan("❯ ") : "  ";

        stdout.write(`${pointer}${icon} ${label}${desc}\n`);
      }

      if (this.filtered.length === 0) {
        stdout.write(chalk.dim("  No matching commands found.\n"));
      }
    };

    const filterItems = () => {
      if (!this.query) {
        this.filtered = this.items;
      } else {
        const q = this.query.toLowerCase();
        // Fuzzy-ish match: includes query
        this.filtered = this.items.filter(
          (i) =>
            i.label.toLowerCase().includes(q) ||
            i.description?.toLowerCase().includes(q),
        );
      }
      this.selectedIndex = 0;
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        stdout.write("\x1B[?25h");
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
        stdout.write("\x1B[2J\x1B[H"); // Clear screen on exit
      };

      const handleKey = (
        _: unknown,
        key: { name: string; ctrl: boolean; sequence: string; meta: boolean },
      ) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }

        if (key.name === "escape") {
          cleanup();
          resolve(null);
          return;
        }

        if (key.name === "return" || key.name === "enter") {
          if (this.filtered.length > 0) {
            cleanup();
            resolve(this.filtered[this.selectedIndex].value);
          }
          return;
        }

        if (key.name === "up") {
          this.selectedIndex = Math.max(0, this.selectedIndex - 1);
          render();
          return;
        }

        if (key.name === "down") {
          this.selectedIndex = Math.min(
            this.filtered.length - 1,
            this.selectedIndex + 1,
          );
          render();
          return;
        }

        if (key.name === "backspace") {
          this.query = this.query.slice(0, -1);
          filterItems();
          render();
          return;
        }

        if (
          key.sequence &&
          key.sequence.length === 1 &&
          !key.ctrl &&
          !key.meta
        ) {
          this.query += key.sequence;
          filterItems();
          render();
          return;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

// BunTUI.ts - Ultra Lightweight & Fast Terminal UI for Bun
// Zero external dependencies. Pure Bun APIs.

import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { emitKeypressEvents } from "node:readline";

// ============================================================================
// 🎨 NATIVE COLOR ENGINE (Pengganti Chalk, Size ~0KB)
// ============================================================================
const c = {
  reset: "\x1b[0m",
  bold: (t: string) => `\x1b[1m${t}\x1b[0m`,
  dim: (t: string) => `\x1b[2m${t}\x1b[0m`,
  underline: (t: string) => `\x1b[4m${t}\x1b[0m`,
  cyan: (t: string) => `${Bun.color("cyan", "ansi")}${t}\x1b[0m`,
  green: (t: string) => `${Bun.color("green", "ansi")}${t}\x1b[0m`,
  red: (t: string) => `${Bun.color("red", "ansi")}${t}\x1b[0m`,
  white: (t: string) => `${Bun.color("white", "ansi")}${t}\x1b[0m`,
  gray: (t: string) => `${Bun.color("gray", "ansi")}${t}\x1b[0m`,
  yellow: (t: string) => `${Bun.color("yellow", "ansi")}${t}\x1b[0m`,
  bgGreenBlackBold: (t: string) => `\x1b[1;30;42m${t}\x1b[0m`,
  bgRedWhiteBold: (t: string) => `\x1b[1;37;41m${t}\x1b[0m`,
  bgBlueWhiteBold: (t: string) => `\x1b[1;37;44m${t}\x1b[0m`,
  bgWhiteBlack: (t: string) => `\x1b[30;47m${t}\x1b[0m`,
  bgBlackWhite: (t: string) => `\x1b[37;40m${t}\x1b[0m`,
  bgBlackCyan: (t: string) => `\x1b[36;40m${t}\x1b[0m`,
  cyanBold: (t: string) => `\x1b[1;36m${t}\x1b[0m`,
  greenBold: (t: string) => `\x1b[1;32m${t}\x1b[0m`,
  whiteBold: (t: string) => `\x1b[1;37m${t}\x1b[0m`,
};

// Helper untuk setup terminal raw mode
function useRawMode() {
  const { stdin, stdout } = process;
  if (stdin.setRawMode) stdin.setRawMode(true);
  stdin.resume();
  emitKeypressEvents(stdin);
  stdout.write("\x1B[?25l"); // Hide cursor
  return () => {
    stdout.write("\x1B[?25h"); // Show cursor
    if (stdin.setRawMode) stdin.setRawMode(false);
    stdin.pause();
  };
}

// ============================================================================
// 📝 TEXT PROMPT
// ============================================================================
export interface TextPromptConfig {
  title: string;
  placeholder?: string;
  initialValue?: string;
  validate?: (value: string) => string | boolean | Promise<string | boolean>;
  password?: boolean;
}

export class TextPrompt {
  private value = "";
  private cursorPos = 0;
  private errorMsg = "";

  constructor(private config: TextPromptConfig) {
    this.value = config.initialValue || "";
    this.cursorPos = this.value.length;
  }

  public async run(): Promise<string> {
    const cleanup = useRawMode();
    const { stdout } = process;

    const render = () => {
      stdout.write("\x1B[2K\r\x1B[B\x1B[2K\x1B[A");
      const displayValue = this.config.password
        ? "*".repeat(this.value.length)
        : this.value;
      let valueStr = c.green(displayValue);
      if (this.value.length === 0 && this.config.placeholder)
        valueStr = c.dim(this.config.placeholder);

      stdout.write(
        `${c.cyan("? ")} ${c.bold(this.config.title)} › ${valueStr}`,
      );
      if (this.errorMsg) {
        stdout.write(`\n${c.red(`✖ ${this.errorMsg}`)}`);
        stdout.write("\x1B[A");
      }
      const visualCursor =
        2 + Bun.stringWidth(this.config.title) + 3 + this.cursorPos;
      stdout.write(`\x1B[${visualCursor + 1}G`);
    };

    render();

    return new Promise((resolve) => {
      const handleKey = async (_: unknown, key: any) => {
        if (this.errorMsg) {
          this.errorMsg = "";
          render();
        }
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }

        switch (key.name) {
          case "return":
          case "enter":
            if (this.config.validate) {
              const res = await this.config.validate(this.value);
              if (typeof res === "string" || res === false) {
                this.errorMsg = typeof res === "string" ? res : "Invalid input";
                return render();
              }
            }
            cleanup();
            stdout.write("\x1B[2K\r");
            stdout.write(
              `${c.cyan("? ")} ${c.bold(this.config.title)} ${c.green(this.value)}\n`,
            );
            resolve(this.value);
            break;
          case "backspace":
            if (this.cursorPos > 0) {
              this.value =
                this.value.slice(0, this.cursorPos - 1) +
                this.value.slice(this.cursorPos);
              this.cursorPos--;
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
            if (this.cursorPos < this.value.length) {
              this.cursorPos++;
              render();
            }
            break;
          default:
            if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
              this.value =
                this.value.slice(0, this.cursorPos) +
                key.sequence +
                this.value.slice(this.cursorPos);
              this.cursorPos++;
              render();
            }
            break;
        }
      };
      process.stdin.on("keypress", handleKey);
    });
  }
}

// ============================================================================
// ✅ CONFIRM
// ============================================================================
export interface ConfirmConfig {
  title: string;
  initialValue?: boolean;
}
export class Confirm {
  private value: boolean;
  constructor(private config: ConfirmConfig) {
    this.value = config.initialValue ?? false;
  }

  public async run(): Promise<boolean> {
    const cleanup = useRawMode();
    const { stdout } = process;

    const render = () => {
      stdout.write("\x1B[2K\r");
      const yes = this.value ? c.bgGreenBlackBold(" Yes ") : c.dim(" Yes ");
      const no = !this.value ? c.bgRedWhiteBold(" No ") : c.dim(" No ");
      stdout.write(
        `${c.cyan("? ")} ${c.bold(this.config.title)}  ${yes}  ${no}`,
      );
    };
    render();

    return new Promise((resolve) => {
      const handleKey = (_: unknown, key: any) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }
        if (["left", "right", "tab", "y", "n"].includes(key.name)) {
          if (key.name === "y") this.value = true;
          else if (key.name === "n") this.value = false;
          else this.value = !this.value;
          render();
        }
        if (key.name === "return" || key.name === "enter") {
          cleanup();
          stdout.write("\x1B[2K\r");
          stdout.write(
            `${c.cyan("? ")} ${c.bold(this.config.title)} ${this.value ? c.green("Yes") : c.red("No")}\n`,
          );
          resolve(this.value);
        }
      };
      process.stdin.on("keypress", handleKey);
    });
  }
}

// ============================================================================
// 📊 PROGRESS BAR (Pure Bun.color gradient)
// ============================================================================
export interface ProgressBarConfig {
  total: number;
  width?: number;
  title?: string;
  style?: "solid" | "blocks" | "dots";
  gradientStart?: string;
  gradientEnd?: string;
  showCount?: boolean;
  showETA?: boolean;
}
export class ProgressBar {
  private current = 0;
  constructor(private config: Required<ProgressBarConfig>) {
    this.config = {
      width: 30,
      title: "Processing",
      style: "solid",
      gradientStart: "#ff520d",
      gradientEnd: "#ffd900",
      showCount: true,
      showETA: true,
      ...config,
    };
    this.startTime = Date.now();
  }
  public update(cur: number) {
    this.current = Math.min(cur, this.config.total);
    this.render();
  }
  public stop(msg?: string, success = true) {
    this.current = this.config.total;
    this.render(true);
    process.stdout.write("\n");
    if (msg)
      process.stdout.write(
        `${Bun.color(success ? "green" : "red", "ansi")}${success ? "✔" : "✖"} ${msg}\x1b[0m\n`,
      );
  }
  private render(_isFinal = false) {
    const ratio = this.config.total > 0 ? this.current / this.config.total : 0;
    const filled = Math.round(ratio * this.config.width);
    const c1 = Bun.color(this.config.gradientStart, "{rgb}") || {
      r: 255,
      g: 255,
      b: 255,
    };
    const c2 = Bun.color(this.config.gradientEnd, "{rgb}") || {
      r: 255,
      g: 255,
      b: 255,
    };
    let barStr = "";
    let fill = "▓",
      empty = "░";
    if (this.config.style === "dots") {
      fill = "●";
      empty = "○";
    }

    for (let i = 0; i < filled; i++) {
      const t = i / this.config.width;
      const r = Math.round(c1.r + (c2.r - c1.r) * t);
      const g = Math.round(c1.g + (c2.g - c1.g) * t);
      const b = Math.round(c1.b + (c2.b - c1.b) * t);
      barStr += `${Bun.color({ r, g, b, a: 1 }, "ansi")}${fill}`;
    }
    for (let i = 0; i < this.config.width - filled; i++)
      barStr += `${Bun.color("#3a3a3a", "ansi")}${empty}`;

    process.stdout.write("\r\x1b[K");
    process.stdout.write(
      `${barStr}\x1b[0m ${this.config.title} \x1b[2m${this.current}/${this.config.total}\x1b[0m`,
    );
  }
}

// ============================================================================
// 🌳 TREE SELECT (Optimized with Bun fs)
// ============================================================================
interface TreeNode {
  name: string;
  path: string;
  depth: number;
  isDir: boolean;
  expanded: boolean;
  children?: TreeNode[];
}
export class TreeSelect {
  private root: TreeNode;
  private flatList: TreeNode[] = [];
  private cursor = 0;
  private scroll = 0;
  private selectedPaths = new Set<string>();
  private lastHeight = 0;

  constructor(
    private config: { title: string; rootDir?: string; multiSelect?: boolean },
  ) {
    this.root = {
      name: basename(rootDir || process.cwd()),
      path: rootDir || process.cwd(),
      depth: 0,
      isDir: true,
      expanded: true,
    };
  }

  private async expand(node: TreeNode) {
    if (!node.isDir || node.children) {
      node.expanded = true;
      return;
    }
    const entries = await readdir(node.path, { withFileTypes: true });
    node.children = entries
      .sort((a, b) =>
        a.isDirectory() === b.isDirectory()
          ? a.name.localeCompare(b.name)
          : a.isDirectory()
            ? -1
            : 1,
      )
      .filter((e) => !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: join(node.path, e.name),
        depth: node.depth + 1,
        isDir: e.isDirectory(),
        expanded: false,
      }));
    node.expanded = true;
  }

  private flatten() {
    this.flatList = [];
    const tr = (n: TreeNode) => {
      this.flatList.push(n);
      if (n.expanded && n.children) n.children.forEach(tr);
    };
    tr(this.root);
  }

  public async run(): Promise<string | string[] | null> {
    const cleanup = useRawMode();
    await this.expand(this.root);
    this.flatten();
    if (this.flatList.length > 1) this.cursor = 1;
    const { stdout } = process;

    const render = () => {
      if (this.lastHeight > 0) stdout.write(`\x1B[${this.lastHeight}A\x1B[0J`);
      const lines = [`${c.cyan("? ")} ${c.bold(this.config.title)}`];
      const maxH = Math.max(5, (stdout.rows || 20) - 5);
      if (this.cursor < this.scroll) this.scroll = this.cursor;
      else if (this.cursor >= this.scroll + maxH)
        this.scroll = this.cursor - maxH + 1;

      this.flatList.slice(this.scroll, this.scroll + maxH).forEach((n, i) => {
        const isFocus = this.scroll + i === this.cursor;
        const indent = "  ".repeat(n.depth);
        const icon = n.isDir ? (n.expanded ? "📂" : "📁") : "📄";
        const check = this.config.multiSelect
          ? `${this.selectedPaths.has(n.path) ? c.green("☑") : c.dim("☐")} `
          : "";
        const content = `${check}${icon} ${n.name}`;
        lines.push(
          `${indent}${isFocus ? c.cyan("❯ ") + c.cyanBold(content) : `  ${c.white(content)}`}`,
        );
      });
      stdout.write(lines.join("\n"));
      this.lastHeight = lines.length;
    };
    render();

    return new Promise((resolve) => {
      const handleKey = async (_: unknown, key: any) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          process.exit(0);
        }
        if (key.name === "escape") {
          cleanup();
          resolve(null);
          return;
        }
        const cur = this.flatList[this.cursor];
        if (key.name === "down")
          this.cursor = Math.min(this.flatList.length - 1, this.cursor + 1);
        if (key.name === "up") this.cursor = Math.max(0, this.cursor - 1);
        if (key.name === "space" && this.config.multiSelect) {
          if (this.selectedPaths.has(cur.path))
            this.selectedPaths.delete(cur.path);
          else this.selectedPaths.add(cur.path);
        }
        if (key.name === "return" || key.name === "enter") {
          if (this.config.multiSelect) {
            cleanup();
            resolve(Array.from(this.selectedPaths));
            return;
          }
          if (cur.isDir) {
            cur.expanded ? (cur.expanded = false) : await this.expand(cur);
            this.flatten();
          } else {
            cleanup();
            resolve(cur.path);
            return;
          }
        }
        render();
      };
      process.stdin.on("keypress", handleKey);
    });
  }
}

// ============================================================================
// 🔔 NOTIFICATION (Cross-platform + FFI Windows MessageBox Bonus)
// ============================================================================
export class Notification {
  static async show(title: string, message: string) {
    const platform = process.platform;
    if (platform === "win32")
      await Notification.winFFI(title, message); // Bisa diganti ke PowerShell XML jika butuh Toast
    else if (platform === "darwin")
      Bun.spawn([
        "osascript",
        "-e",
        `display notification "${message}" with title "${title}"`,
      ]);
    else Bun.spawn(["sh", "-c", `notify-send "${title}" "${message}"`]);
  }

  // 🔥 BONUS: Pakai bun:ffi langsung ke user32.dll (Super cepat, 0 dependency, tanpa PowerShell)
  private static async winFFI(title: string, message: string) {
    try {
      const { dlopen, ptr } = require("bun:ffi");
      const user32 = dlopen("user32.dll", {
        MessageBoxA: {
          args: ["pointer", "cstring", "cstring", "i32"],
          returns: "i32",
        },
      });
      user32.symbols.MessageBoxA(ptr(0), message, title, 0x00000040); // 0x40 = MB_ICONINFORMATION
    } catch (_e) {
      // Fallback ke PowerShell jika FFI gagal
      Bun.spawn(
        [
          "powershell",
          "-c",
          `New-BurntToastNotification -Text "${title}","${message}"`,
        ],
        { windowsHide: true },
      );
    }
  }
}

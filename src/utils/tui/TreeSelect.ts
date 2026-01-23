import { readdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import chalk from "chalk";

interface TreeNode {
  name: string;
  path: string;
  depth: number;
  isDirectory: boolean;
  isExpanded: boolean;
  children?: TreeNode[];
  parent?: TreeNode;
}

export interface TreeSelectConfig {
  title: string;
  rootDir?: string;
  maxDepth?: number;
  onlyDirectories?: boolean;
}

export class TreeSelect {
  private config: TreeSelectConfig;
  private rootNode: TreeNode;

  private flatList: TreeNode[] = [];
  private cursorIndex = 0;
  private scrollOffset = 0;
  private termHeight = process.stdout.rows || 20;
  private lastRenderHeight = 0;

  private icons = {
    dirOpen: "📂",
    dirClosed: "📁",
    file: "📄",
    cursor: "❯",
    selected: "●",
  };

  constructor(config: TreeSelectConfig) {
    this.config = {
      rootDir: process.cwd(),
      maxDepth: 10,
      ...config,
    };

    this.rootNode = {
      name: basename(this.config.rootDir ?? process.cwd()),
      path: this.config.rootDir ?? process.cwd(),
      depth: 0,
      isDirectory: true,
      isExpanded: true,
    };
  }

  private async expandNode(node: TreeNode) {
    if (!node.isDirectory || node.children) {
      node.isExpanded = true;
      return;
    }
    try {
      const entries = await readdir(node.path, { withFileTypes: true });
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() === b.isDirectory())
          return a.name.localeCompare(b.name);
        return a.isDirectory() ? -1 : 1;
      });

      node.children = sorted
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: join(node.path, e.name),
          depth: node.depth + 1,
          isDirectory: e.isDirectory(),
          isExpanded: false,
          parent: node,
        }));

      node.isExpanded = true;
    } catch (_e) {
      node.children = [];
    }
  }

  private collapseNode(node: TreeNode) {
    node.isExpanded = false;
  }

  private flattenTree() {
    const list: TreeNode[] = [];
    const traverse = (node: TreeNode) => {
      list.push(node);
      if (node.isExpanded && node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(this.rootNode);
    this.flatList = list;
  }

  public async run(): Promise<string | null> {
    const { stdin, stdout } = process;

    await this.expandNode(this.rootNode);
    this.flattenTree();
    if (this.flatList.length > 1) this.cursorIndex = 1;

    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    emitKeypressEvents(stdin);
    stdout.write("\x1B[?25l");

    let isFirstRender = true;

    const render = () => {
      if (!isFirstRender) {
        stdout.write(`\x1B[${this.lastRenderHeight}A`);
        stdout.write("\x1B[0J");
      }

      const linesToRender: string[] = [];

      // 🔥 FIX: Tambahin \r (Carriage Return) setelah \x1B[2K
      // Ini maksa kursor mentok kiri sebelum nulis text.

      // HEADER
      linesToRender.push(
        `\x1B[2K\r${chalk.cyan("? ")} ${chalk.bold(this.config.title)}`,
      );
      linesToRender.push(
        `\x1B[2K\r${chalk.dim("  Arrows to Move. Space to Select. Enter to Toggle.")}`,
      );

      // BODY
      const maxBodyHeight = Math.max(5, this.termHeight - 5);

      if (this.cursorIndex < this.scrollOffset) {
        this.scrollOffset = this.cursorIndex;
      } else if (this.cursorIndex >= this.scrollOffset + maxBodyHeight) {
        this.scrollOffset = this.cursorIndex - maxBodyHeight + 1;
      }
      this.scrollOffset = Math.max(
        0,
        Math.min(this.scrollOffset, this.flatList.length - maxBodyHeight),
      );

      const visibleNodes = this.flatList.slice(
        this.scrollOffset,
        this.scrollOffset + maxBodyHeight,
      );

      visibleNodes.forEach((node, i) => {
        const isFocused = this.scrollOffset + i === this.cursorIndex;
        const indent = "  ".repeat(node.depth);

        const icon = node.isDirectory
          ? node.isExpanded
            ? this.icons.dirOpen
            : this.icons.dirClosed
          : this.icons.file;

        let content = `${icon} ${node.name}`;
        let prefix = "  ";

        if (isFocused) {
          prefix = chalk.cyan(`${this.icons.cursor} `);
          content = chalk.cyan.bold(content);
        } else {
          content = chalk.white(content);
        }

        // 🔥 FIX: Tambahin \r di sini juga
        linesToRender.push(`\x1B[2K\r${indent}${prefix}${content}`);
      });

      // Fill empty space
      const remainingLines = maxBodyHeight - visibleNodes.length;
      for (let i = 0; i < remainingLines; i++) {
        linesToRender.push("\x1B[2K\r"); // 🔥 FIX
      }

      // FOOTER
      const selectedNode = this.flatList[this.cursorIndex];
      let pathInfo = selectedNode ? selectedNode.path : "";
      if (pathInfo.length > stdout.columns - 10) {
        pathInfo = `...${pathInfo.slice(-(stdout.columns - 15))}`;
      }

      linesToRender.push("\x1B[2K\r"); // 🔥 FIX: Spacer
      linesToRender.push(`\x1B[2K\r${chalk.dim(`Path: ${pathInfo}`)}`); // 🔥 FIX

      const output = linesToRender.join("\n");
      stdout.write(output);

      this.lastRenderHeight = linesToRender.length;
      isFirstRender = false;
    };

    render();

    return new Promise((resolve) => {
      const cleanup = () => {
        stdout.write(`\x1B[${this.lastRenderHeight}A`);
        stdout.write("\x1B[0J");

        stdout.write("\x1B[?25h\r");
        if (stdin.setRawMode) stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener("keypress", handleKey);
      };

      const handleKey = async (
        _: unknown,
        key: { name: string; ctrl: boolean },
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

        const currentNode = this.flatList[this.cursorIndex];

        switch (key.name) {
          case "up":
          case "k":
            this.cursorIndex = Math.max(0, this.cursorIndex - 1);
            render();
            break;

          case "down":
          case "j":
            this.cursorIndex = Math.min(
              this.flatList.length - 1,
              this.cursorIndex + 1,
            );
            render();
            break;

          // SELECT
          case "space":
            cleanup();
            resolve(currentNode.path);
            return;

          // TOGGLE ONLY
          case "return":
          case "enter":
          case "right":
          case "l":
            if (currentNode.isDirectory) {
              if (!currentNode.isExpanded) {
                await this.expandNode(currentNode);
              } else if (
                currentNode.isExpanded &&
                (key.name === "return" || key.name === "enter")
              ) {
                this.collapseNode(currentNode);
              }
              this.flattenTree();
              render();
            }
            break;

          case "left":
          case "h":
            if (currentNode.isDirectory && currentNode.isExpanded) {
              this.collapseNode(currentNode);
              this.flattenTree();
              render();
            } else if (currentNode.parent) {
              const parentIdx = this.flatList.indexOf(currentNode.parent);
              if (parentIdx !== -1) {
                this.cursorIndex = parentIdx;
                render();
              }
            }
            break;
        }
      };

      stdin.on("keypress", handleKey);
    });
  }
}

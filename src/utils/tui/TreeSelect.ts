// --- TreeSelect.ts ---
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { ANSI, c, type KeyPress, useInput, write } from "./core";

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
  multiSelect?: boolean;
}

export class TreeSelect {
  private config: TreeSelectConfig;
  private rootNode: TreeNode;

  private flatList: TreeNode[] = [];
  private cursorIndex = 0;
  private scrollOffset = 0;
  private termHeight = process.stdout.rows || 20;
  private lastRenderHeight = 0;

  private selectedPaths = new Set<string>();

  private icons = {
    dirOpen: "📂",
    dirClosed: "📁",
    file: "📄",
    cursor: "❯",
    checked: "☑",
    unchecked: "☐",
  };

  constructor(config: TreeSelectConfig) {
    this.config = {
      rootDir: process.cwd(),
      maxDepth: 10,
      multiSelect: false,
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

  // Menggunakan Sync API untuk menghindari race condition render TUI
  private expandNodeSync(node: TreeNode) {
    if (!node.isDirectory || node.children) {
      node.isExpanded = true;
      return;
    }
    try {
      const entries = readdirSync(node.path, { withFileTypes: true });
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

  public async run(): Promise<string | string[] | null> {
    this.expandNodeSync(this.rootNode);
    this.flattenTree();
    if (this.flatList.length > 1) this.cursorIndex = 1;

    write(ANSI.HIDE_CURSOR);

    let isFirstRender = true;

    const render = () => {
      this.termHeight = process.stdout.rows || 20;

      if (!isFirstRender) {
        write(`\x1B[${this.lastRenderHeight}A`);
        write(ANSI.CLEAR_DOWN); // \x1B[J
      }

      const linesToRender: string[] = [];

      // HEADER
      linesToRender.push(
        `\x1B[2K\r${c.cyan("? ")} ${c.bold(this.config.title)}`,
      );

      let helpText = "  Arrows to Move. Space to Toggle. Enter to Confirm.";
      if (!this.config.multiSelect) {
        helpText = "  Arrows to Move. Space/Enter to Select. Right to Expand.";
      }
      linesToRender.push(`\x1B[2K\r${c.dim(helpText)}`);

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

        const isChecked =
          this.config.multiSelect && this.selectedPaths.has(node.path);
        const checkbox = this.config.multiSelect
          ? `${isChecked ? c.green(this.icons.checked) : c.dim(this.icons.unchecked)} `
          : "";

        let content = `${checkbox}${icon} ${node.name}`;
        let prefix = "  ";

        if (isFocused) {
          prefix = c.cyan(`${this.icons.cursor} `);
          content = c.cyan(c.bold(content));
        } else {
          content = `${ANSI.RESET}${content}`;
        }

        linesToRender.push(`\x1B[2K\r${indent}${prefix}${content}`);
      });

      const remainingLines = maxBodyHeight - visibleNodes.length;
      for (let i = 0; i < remainingLines; i++) {
        linesToRender.push("\x1B[2K\r");
      }

      // FOOTER
      const selectedNode = this.flatList[this.cursorIndex];
      let pathInfo = selectedNode ? selectedNode.path : "";
      const maxPathLen = (process.stdout.columns || 80) - 10;

      if (Bun.stringWidth(pathInfo) > maxPathLen) {
        pathInfo = `...${pathInfo.slice(-(maxPathLen - 5))}`;
      }

      linesToRender.push("\x1B[2K\r");
      linesToRender.push(`\x1B[2K\r${c.dim(`Path: ${pathInfo}`)}`);

      write(linesToRender.join("\n"));

      this.lastRenderHeight = linesToRender.length;
      isFirstRender = false;
    };

    render();

    return new Promise((resolve) => {
      const cleanup = useInput((key: KeyPress) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          write(
            `\x1B[${this.lastRenderHeight}A${ANSI.CLEAR_DOWN}${ANSI.SHOW_CURSOR}\r`,
          );
          process.exit(0);
        }

        if (key.name === "escape") {
          cleanup();
          write(
            `\x1B[${this.lastRenderHeight}A${ANSI.CLEAR_DOWN}${ANSI.SHOW_CURSOR}\r`,
          );
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

          case "space": {
            if (this.config.multiSelect) {
              if (currentNode) {
                if (this.selectedPaths.has(currentNode.path)) {
                  this.selectedPaths.delete(currentNode.path);
                } else {
                  this.selectedPaths.add(currentNode.path);
                }
              }
              render();
            } else {
              cleanup();
              write(
                `\x1B[${this.lastRenderHeight}A${ANSI.CLEAR_DOWN}${ANSI.SHOW_CURSOR}\r`,
              );
              resolve(currentNode.path);
            }
            break;
          }

          case "return":
          case "enter": {
            if (this.config.multiSelect) {
              cleanup();
              write(
                `\x1B[${this.lastRenderHeight}A${ANSI.CLEAR_DOWN}${ANSI.SHOW_CURSOR}\r`,
              );
              resolve(Array.from(this.selectedPaths));
              return;
            }

            if (currentNode.isDirectory) {
              if (!currentNode.isExpanded) {
                this.expandNodeSync(currentNode);
              } else {
                this.collapseNode(currentNode);
              }
              this.flattenTree();
              render();
            } else {
              cleanup();
              write(
                `\x1B[${this.lastRenderHeight}A${ANSI.CLEAR_DOWN}${ANSI.SHOW_CURSOR}\r`,
              );
              resolve(currentNode.path);
            }
            break;
          }

          case "right":
          case "l":
            if (currentNode.isDirectory && !currentNode.isExpanded) {
              this.expandNodeSync(currentNode);
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
      });
    });
  }
}

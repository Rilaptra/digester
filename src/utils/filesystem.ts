import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

/**
 * Opens a file or directory using the default system application.
 * Cross-platform support (Windows/macOS/Linux).
 *
 * @param {string} path - The path to the file or directory to open.
 * @returns {void}
 *
 * @example
 * openFile("./generated"); // Opens File Explorer/Finder
 */
export function openFile(path: string): void {
  const cmd = process.platform === "win32" ? "explorer" : "open";
  // Linux fallback usually needs 'xdg-open', adding simplistic support here
  const finalCmd =
    process.platform === "linux" ? "xdg-open" : cmd;

  spawn(finalCmd, [path], { stdio: "ignore", detached: true }).unref();
}

/**
 * Resolves a path string to an absolute path, ensuring it exists.
 * Checks CWD first, then the parent directory.
 *
 * @param {string} input - The relative or absolute path input.
 * @returns {string | null} The absolute path if found, or null if invalid.
 *
 * @example
 * resolvePath("src"); // Returns "/User/Project/src"
 * resolvePath("non-existent"); // Returns null
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
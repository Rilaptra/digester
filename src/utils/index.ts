import { spawn } from "node:child_process"; // Bun.spawn is async, for openFile we often want fire-and-forget or specific detach
import { existsSync } from "node:fs"; // Bun.file().exists() is async, keep sync for simple checks if needed, but prefer async where possible
import { isAbsolute, resolve } from "node:path";
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

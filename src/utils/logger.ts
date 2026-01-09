import chalk from "chalk";

type LogType = "info" | "error" | "warn" | "success" | "debug";

interface ProgressOptions {
  current: number;
  total: number;
  startAt: number;
  title?: string;
  length?: number;
}

interface LogOptions {
  type: LogType;
  eventName?: string;
  system?: string;
  progress?: ProgressOptions;
  raw?: boolean;
  noContext?: boolean;
}

// 1. Pre-instantiate Formatter & Colors (Zero-alloc during logs)
const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Jakarta",
});

const COLORS = {
  info: chalk.cyan,
  error: chalk.red,
  warn: chalk.yellow,
  success: chalk.green,
  debug: chalk.magenta,
} as const;

const LABELS = Object.fromEntries(
  Object.keys(COLORS).map((k) => [k, COLORS[k as LogType](k.toUpperCase())]),
);

/**
 * Optimized getCaller dengan limitasi stack depth untuk hemat memori
 */
function getCaller(): string {
  const oldStackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 4; // Batasi pencarian hanya 4 level ke bawah
  const stack = new Error().stack;
  Error.stackTraceLimit = oldStackTraceLimit;

  if (!stack) return "SYSTEM";

  const lines = stack.split("\n");
  const callerLine = lines[3] || "";
  const match = /at\s+(?:async\s+)?([^\s(]+)/.exec(callerLine);

  if (match?.[1]) {
    const name = match[1].split(".").pop();
    return !name ||
      name === "Object" ||
      name === "<anonymous>" ||
      name.includes("ts:")
      ? "SYSTEM"
      : name;
  }
  return "SYSTEM";
}

// OVERLOADS
export function generateLog(
  options: Omit<LogOptions, "progress"> & { progress: ProgressOptions },
  ...message: never[]
): void;
export function generateLog(
  options: Omit<LogOptions, "progress"> & { progress?: never },
  // biome-ignore lint/suspicious/noExplicitAny: <explanation: biome-ignore>
  ...message: any[]
): void;

// biome-ignore lint/suspicious/noExplicitAny: <explanation: biome-ignore>
export function generateLog(options: LogOptions, ...message: any[]) {
  const { type, eventName, system, progress, raw, noContext } = options;

  // 0. Raw Output - Bypass formatting completely
  if (raw) {
    const rawBody = message.length === 1 ? message[0] : message.join(" ");
    console.log(rawBody);
    return;
  }

  const time = timeFormatter.format(Date.now());
  const prefix = `[${LABELS[type]}] ${chalk.gray(time)}`;

  // 1. Context Resolution - Skips getCaller if noContext is true
  let context = "";
  if (!noContext) {
    const contextRaw = eventName ?? system ?? getCaller();
    context = (
      eventName ? chalk.green.bold(contextRaw) : chalk.magenta.bold(contextRaw)
    ).padEnd(25);
  }

  let logBody = "";

  if (progress) {
    const { current, total, startAt, title = "Task", length = 20 } = progress;
    const ratio = Math.min(1, Math.max(0, current / total));
    const filled = (length * ratio) | 0; // Bitwise OR for fast floor

    // Fast Time Calculation (Avoid object creation)
    const elapsedMs = Date.now() - startAt;
    const totalSec = (elapsedMs / 1000) | 0;
    const h = ((totalSec / 3600) | 0).toString().padStart(2, "0");
    const m = (((totalSec % 3600) / 60) | 0).toString().padStart(2, "0");
    const s = (totalSec % 60).toString().padStart(2, "0");

    const isDone = ratio >= 1;
    const color = isDone ? chalk.green : COLORS[type];

    // String Builder pattern
    const bar =
      color("━".repeat(filled)) + chalk.gray("━".repeat(length - filled));
    const percent = `${((ratio * 100) | 0).toString().padStart(3)}%`;

    logBody = `Processing ${chalk.yellow(title)} ${bar} ${color(
      percent,
    )} ${chalk.cyan(`[${h}:${m}:${s}]`)}`;
  } else {
    // Use join only if message > 1 for RAM efficiency
    logBody = message.length === 1 ? String(message[0]) : message.join(" ");
  }

  // 3. Bun Native Output
  const output = noContext
    ? `${prefix} ${logBody}\n`
    : `${prefix} ${context} ${logBody}\n`;
  Bun.write(Bun.stdout, output);
}

// --- core.ts ---
// Zero-dependency TUI Core for Bun

export const ANSI = {
  HIDE_CURSOR: "\x1B[?25l",
  SHOW_CURSOR: "\x1B[?25h",
  CLEAR_LINE: "\x1B[2K\r",
  CLEAR_DOWN: "\x1B[J",
  ALT_BUFFER: "\x1B[?1049h",
  MAIN_BUFFER: "\x1B[?1049l",
  RESET: "\x1B[0m",
  BOLD: "\x1B[1m",
  DIM: "\x1B[2m",
};

// Helper warna menggantikan chalk (Sangat cepat karena native Bun)
export const c = {
  cyan: (t: string) => `${Bun.color("cyan", "ansi")}${t}${ANSI.RESET}`,
  green: (t: string) => `${Bun.color("green", "ansi")}${t}${ANSI.RESET}`,
  red: (t: string) => `${Bun.color("red", "ansi")}${t}${ANSI.RESET}`,
  yellow: (t: string) => `${Bun.color("yellow", "ansi")}${t}${ANSI.RESET}`,
  bold: (t: string) => `${ANSI.BOLD}${t}${ANSI.RESET}`,
  dim: (t: string) => `${ANSI.DIM}${t}${ANSI.RESET}`,
  bgGreen: (t: string) =>
    `${Bun.color("black", "ansi")}\x1B[42m${t}${ANSI.RESET}`,
  bgRed: (t: string) => `\x1B[41m\x1B[37m${t}${ANSI.RESET}`,
};

export interface KeyPress {
  name: string;
  ctrl: boolean;
  meta: boolean;
  sequence: string;
}

const decodeKey = (seq: string): KeyPress => {
  let name = "";
  let ctrl = false;
  let meta = false;

  if (seq === "\r" || seq === "\n") name = "return";
  else if (seq === "\t") name = "tab";
  else if (seq === "\x7f" || seq === "\b") name = "backspace";
  else if (seq === "\x1b") name = "escape";
  else if (seq === "\x1b[A") name = "up";
  else if (seq === "\x1b[B") name = "down";
  else if (seq === "\x1b[C") name = "right";
  else if (seq === "\x1b[D") name = "left";
  else if (seq === "\x1b[H" || seq === "\x1bOH" || seq === "\x1b[1~")
    name = "home";
  else if (seq === "\x1b[F" || seq === "\x1bOF" || seq === "\x1b[4~")
    name = "end";
  else if (seq === "\x1b[5~") name = "pageup";
  else if (seq === "\x1b[6~") name = "pagedown";
  else if (seq === " ") name = "space";
  else if (
    seq.length === 1 &&
    seq.charCodeAt(0) < 32 &&
    seq.charCodeAt(0) > 0
  ) {
    ctrl = true;
    name = String.fromCharCode(seq.charCodeAt(0) + 96);
  } else if (seq.length === 1) {
    name = seq;
  } else if (seq.length === 2 && seq.charCodeAt(0) === 27) {
    meta = true;
    name = seq[1];
  }

  return { name, ctrl, meta, sequence: seq };
};

// Pengganti node:readline (Membaca byte mentah dari process.stdin)
// core.ts
export function useInput(handler: (key: KeyPress) => void): () => void {
  // Pastikan raw mode di set true
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  const onData = (chunk: string) => {
    // Handle escape sequences (tombol panah, dll)
    if (chunk.startsWith("\x1b")) {
      const key = decodeKey(chunk);
      handler(key);
    } else {
      // Handle karakter biasa atau paste
      for (const char of chunk) {
        const key = decodeKey(char);
        handler(key);
      }
    }
  };

  process.stdin.on("data", onData);

  // Cleanup function
  return () => {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdin.removeListener("data", onData);
  };
}

// Helper tulis cepat
export const write = (str: string) => process.stdout.write(str);

import chalk from "chalk";

/**
 * Formats a number of bytes into a human-readable string (B, KB, MB, GB).
 *
 * @param {number} bytes - The size in bytes to format.
 * @returns {string} The formatted string (e.g., "1.50 MB").
 *
 * @example
 * formatSize(1572864); // Returns "1.50 MB"
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(2)} ${["B", "KB", "MB", "GB"][i]}`;
}

/**
 * Estimates the token count for LLM context based on file size (bytes).
 * Uses a rough approximation: 1 token ≈ 4 characters, but conservative (bytes / 2)
 * to account for code density.
 *
 * @param {number} bytes - The size of the text content in bytes.
 * @returns {string} The estimated token count formatted (e.g., "1.2k", "15M").
 *
 * @example
 * estimateTokens(5000); // Returns "2.5k"
 */
export function estimateTokens(bytes: number): string {
  // Rule of thumb: 1 token ~ 4 chars.
  // Code is dense, so bytes/2 is a safe conservative upper bound for allocation.
  const tokens = Math.ceil(bytes / 2.853283767038414);

  if (tokens > 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  return tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens.toString();
}

/**
 * Formats a raw commit message or log line with specific color rules.
 * (Optional helper if you want to centralize styling later)
 */
export function styleLogTag(tag: string): string {
  return chalk.bgCyan.black(` ${tag} `);
}

/**
 * 🔥 NATIVE BUN: Menghitung lebar visual string di terminal.
 * Otomatis mengabaikan ANSI escape codes dan menghitung Emoji/Unicode dengan benar.
 * Jauh lebih cepat (~6000x) daripada package `string-width`.
 */
export function visibleWidth(text: string): number {
  if (!text) return 0;
  return Bun.stringWidth(text, { countAnsiEscapeCodes: false });
}

/**
 * 🔥 NATIVE BUN: Menghapus semua kode warna ANSI dari string.
 */
export function stripAnsi(text: string): string {
  if (!text) return "";
  return Bun.stripANSI(text);
}

/**
 * Helper untuk padding string berdasarkan lebar visual, bukan length karakter.
 */
export function padEndVisual(
  text: string,
  targetWidth: number,
  char = " ",
): string {
  const currentWidth = visibleWidth(text);
  const diff = targetWidth - currentWidth;
  if (diff <= 0) return text;
  return text + char.repeat(diff);
}

export function truncateVisual(
  text: string,
  maxWidth: number,
  ellipsis = "…",
): string {
  if (visibleWidth(text) <= maxWidth) return text;
  // Fallback sederhana: strip ANSI, potong, kasih ellipsis (bisa di-improve kalau butuh ANSI-aware truncation)
  const plain = stripAnsi(text);
  if (plain.length <= maxWidth - 1) return plain + ellipsis;
  return plain.slice(0, maxWidth - 1) + ellipsis;
}

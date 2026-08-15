// --- ProgressBar.ts ---
import { ANSI, write } from "./core";

type RGB = { r: number; g: number; b: number };

export interface ProgressBarConfig {
  total: number;
  width?: number;
  title?: string;
  style?: "solid" | "blocks" | "dots";
  barColor?: string | "gradient"; // Accepts any CSS color string or "gradient"
  fillColor?: string;
  textColor?: string;
  showCount?: boolean;
  showPercentage?: boolean;
  showETA?: boolean;
  gradientStart?: string; // Any CSS color
  gradientEnd?: string; // Any CSS color
}

// Helper kecil untuk parsing warna hex ke RGB (Untuk gradient)
function hexToRgb(hex: string): RGB {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

export class ProgressBar {
  private config: Required<ProgressBarConfig>;
  private current = 0;
  private startTime: number;

  constructor(config: ProgressBarConfig) {
    this.config = {
      width: 30,
      title: "Processing",
      style: "solid",
      barColor: "cyan",
      fillColor: "#3a3a3a",
      textColor: "#ffffff",
      showCount: true,
      showPercentage: true,
      showETA: true,
      gradientStart: "#ff520d",
      gradientEnd: "#ffd900",
      ...config,
    };
    this.startTime = Date.now();
  }

  // Helper interpolasi gradient
  private interpolateColor(c1: RGB, c2: RGB, t: number): string {
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
    return Bun.color({ r, g, b, a: 1 }, "ansi") || "";
  }

  // Helper apply warna ke teks
  private colorize(text: string, color: string): string {
    const ansiCode = Bun.color(color, "ansi");
    return ansiCode ? `${ansiCode}${text}${ANSI.RESET}` : text;
  }

  public start() {
    this.render();
  }

  public update(current: number) {
    this.current = Math.min(current, this.config.total);
    this.render();
  }

  public increment(amount: number = 1) {
    this.update(this.current + amount);
  }

  public stop(message?: string, success: boolean = true) {
    this.current = this.config.total;
    this.render(true);
    write("\n"); // Move to next line
    if (message) {
      const ansiColor = success
        ? Bun.color("green", "ansi")
        : Bun.color("red", "ansi");
      const icon = success ? "✔" : "✖";
      write(`${ansiColor}${icon} ${message}${ANSI.RESET}\n`);
    }
  }

  private render(isFinal = false) {
    const ratio = this.config.total > 0 ? this.current / this.config.total : 0;
    const percent = Math.round(ratio * 100);
    const filled = Math.round(ratio * this.config.width);
    const empty = this.config.width - filled;

    // Parsing warna gradient ke RGB sekali saja
    const c1 = hexToRgb(this.config.gradientStart);
    const c2 = hexToRgb(this.config.gradientEnd);

    let barStr = "";
    let fillChar = "─"; // Default solid
    let emptyChar = "─";

    if (this.config.style === "blocks") {
      fillChar = "▓";
      emptyChar = "░";
    } else if (this.config.style === "dots") {
      fillChar = "●";
      emptyChar = "○";
    }

    // Render Filled Part
    for (let i = 0; i < filled; i++) {
      if (this.config.barColor === "gradient") {
        const t = i / this.config.width;
        barStr += this.interpolateColor(c1, c2, t) + fillChar + ANSI.RESET;
      } else {
        barStr += this.colorize(fillChar, this.config.barColor);
      }
    }

    // Render Empty Part
    for (let i = 0; i < empty; i++) {
      barStr += this.colorize(emptyChar, this.config.fillColor);
    }

    // Render Text Info
    const textParts: string[] = [];
    if (this.config.title)
      textParts.push(this.colorize(this.config.title, this.config.textColor));
    if (this.config.showCount)
      textParts.push(
        `${ANSI.DIM}${this.current}/${this.config.total}${ANSI.RESET}`,
      );
    if (this.config.showPercentage)
      textParts.push(
        `${ANSI.BOLD}${this.colorize(`${percent}%`, this.config.textColor)}${ANSI.RESET}`,
      );

    if (this.config.showETA && this.current > 0 && !isFinal) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const eta = (elapsed / this.current) * (this.config.total - this.current);
      textParts.push(
        `${ANSI.DIM}[${Math.floor(elapsed)}s/${Math.ceil(eta)}s]${ANSI.RESET}`,
      );
    }

    const line = `${barStr} ${textParts.join(" ")}`;

    // Clear line and write
    write("\r\x1B[K"); // CR + Clear line
    write(line);
  }
}

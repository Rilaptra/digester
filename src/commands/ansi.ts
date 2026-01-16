import { color, file, write } from "bun";
import { BaseCommand } from "../core/BaseCommand.js";

interface AnsiConfig {
  text: string;
  from: string;
  to: string;
  output: string;
}

export class AnsiCommand extends BaseCommand {
  public name = "ansi";
  public description =
    "Generate raw ANSI gradient art files from text or files.";
  public aliases = ["art", "gradient"];

  public async execute(args: string[]): Promise<void> {
    this.createBox(
      "⚡ BUN ANSI ART GENERATOR\nGenerate beautiful gradient ANSI text files.",
      "ANSI Generator",
    );

    // 1. Parse Arguments & Flags
    let text = "";
    let fromColor = "#ff520d"; // Default: Orange Fire
    let toColor = "#ffd900"; // Default: Yellow
    let outputFile = "generated_ansi.txt";
    let inputFilePath: string | undefined;

    // Simple arg parsing (can be improved with a proper parser lib if available in project, but manual is fine for now)
    const cleanArgs = [];
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.startsWith("--from=")) {
        fromColor = arg.split("=")[1];
      } else if (arg.startsWith("--to=")) {
        toColor = arg.split("=")[1];
      } else if (arg.startsWith("--out=")) {
        outputFile = arg.split("=")[1];
      } else if (arg.startsWith("--file=")) {
        inputFilePath = arg.split("=")[1];
      } else if (arg === "--from" && args[i + 1]) {
        fromColor = args[++i];
      } else if (arg === "--to" && args[i + 1]) {
        toColor = args[++i];
      } else if (arg === "--out" && args[i + 1]) {
        outputFile = args[++i];
      } else if (arg === "--file" && args[i + 1]) {
        inputFilePath = args[++i];
      } else {
        cleanArgs.push(arg);
      }
    }

    // 2. Interactive Prompts if insufficient info
    if (!inputFilePath && cleanArgs.length === 0) {
      const mode = await this.promptSelectV2("Choose Input Source:", [
        "Type Text",
        "Read from File",
      ]);

      if (mode === "Type Text") {
        text = await this.promptText(
          "Enter text to gradient-ize:",
          "Hello World",
        );
      } else {
        inputFilePath = await this.promptText("Enter file path:", "./art.txt");
      }

      // Also prompt for config if not provided via flags (optional quality of life)
      // Only prompt if they didn't provide flags, to keep it fast for power users
      // But for now, let's assume defaults are okay unless they change them, or we can offer a "Custom Config?" prompt.
      const customize = await this.promptYesNo(
        "Customize colors and output?",
        false,
      );
      if (customize) {
        fromColor = await this.promptText("Start Color (Hex):", fromColor);
        toColor = await this.promptText("End Color (Hex):", toColor);
        outputFile = await this.promptText("Output Filename:", outputFile);
      }
    } else if (inputFilePath) {
      // confirm file exists
      const f = file(inputFilePath);
      if (!(await f.exists())) {
        this.error(`Input file not found: ${inputFilePath}`);
        return;
      }
      text = await f.text();
    } else {
      text = cleanArgs.join(" ");
    }

    // Safety check for empty text
    if (!text.trim()) {
      const f = file(inputFilePath || "");
      if (inputFilePath && (await f.exists())) {
        text = await f.text();
      } else {
        this.error("No text provided to render.");
        return;
      }
    }

    // 3. Render
    await this.generateGradient({
      text,
      from: fromColor,
      to: toColor,
      output: outputFile,
    });
  }

  private lerp(start: number, end: number, t: number): number {
    return Math.round(start + (end - start) * t);
  }

  private parseColor(color: string): { r: number; g: number; b: number } {
    const match = color.match(/\d+/g);
    if (!match || match.length !== 3) {
      throw new Error(`Invalid color format: ${color}`);
    }
    return {
      r: Number(match[0]),
      g: Number(match[1]),
      b: Number(match[2]),
    };
  }

  private async generateGradient(config: AnsiConfig) {
    const loader = this.spinner("🎨 Parsing colors and preparing render...");

    // 1. Parsing Colors
    // Bun's color() function can return null/undefined if invalid
    // convert from 'rgb(255, 0, 0)' to {r: 255, g: 0, b: 0}
    const c1 = this.parseColor(color(config.from, "rgb") || "");
    const c2 = this.parseColor(color(config.to, "rgb") || "");

    if (!c1 || !c2) {
      loader.fail(
        "❌ Invalid Colors provided. Please use Hex codes (e.g. #ff0000) or standard names.",
      );
      return;
    }

    loader.text = "🎨 Rendering ANSI Gradient...";

    // 2. Setup Lines
    const lines = config.text.split("\n"); // Keep empty lines for spacing
    const maxWidth = Math.max(...lines.map((l) => l.length));

    // Buffer for efficiency
    const outputBuffer: string[] = [];

    // 3. Render Loop
    for (const line of lines) {
      // If line is empty, just push newline (well, push empty string, join later adds newline)
      if (line.length === 0) {
        outputBuffer.push("");
        continue;
      }

      const chars = [...line];
      let lineResult = "";

      chars.forEach((char, x) => {
        // Calculate Ratio (horizontal gradient)
        // We can also support vertical if we use line index, but horizontal is standard for text art usually.
        const t = maxWidth > 1 ? x / (maxWidth - 1) : 0;

        // Calculate RGB
        const rgbObj = {
          r: this.lerp(c1.r, c2.r, t),
          g: this.lerp(c1.g, c2.g, t),
          b: this.lerp(c1.b, c2.b, t),
        };

        // Get ANSI Code
        const ansi = color(rgbObj, "ansi");

        // Append
        lineResult += `${ansi}${char}`;
      });

      outputBuffer.push(lineResult);
    }

    // Add reset at the end to be safe?
    // Usually good practice to reset color at end of file, but raw ANSI files might expect to just set colors.
    // Let's add a reset code \x1b[0m just in case at the very end.
    outputBuffer.push("\x1b[0m");

    // 4. Save to File
    loader.text = "💾 Saving to file...";
    try {
      await write(config.output, outputBuffer.join("\n"));
      loader.succeed(`✅ Saved Raw ANSI string to: ${config.output}`);
      this.info(`ℹ️  View it using: cat ${config.output}`);
      this.dim(
        `(Or use 'type ${config.output}' on Windows cmd, 'cat' on PowerShell/Bash)`,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      loader.fail(`❌ Failed to save file: ${msg}`);
    }
  }
}

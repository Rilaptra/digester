// --- src/commands/test.ts ---
import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { promptSelectV2 } from "../utils/index.js";

export class TestCommand extends BaseCommand {
  public name = "test";
  public description = "Demo of promptSelectV2 interactive GRID menu";
  public aliases = ["demo", "tui"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🎮 TUI GRID SYSTEM");

    // TEST 1: GRID MODE (2 Kolom)
    this.log(chalk.bold.white("\n--- Test 1: Grid Layout (2 Cols) ---"));
    const lang = await promptSelectV2(
      "Choose your weapon:",
      [
        "TypeScript",
        "JavaScript",
        "Rust",
        "Go",
        "Python",
        "C++",
        "Zig",
        "Odin",
      ],
      { columns: 2, allowCustom: true }, // 🔥 2 Kolom
    );
    this.success(`Selected: ${lang}`);

    // TEST 2: COMPACT MODE (3 Kolom)
    this.log(chalk.bold.white("\n--- Test 2: Compact Grid (3 Cols) ---"));
    const framework = await promptSelectV2(
      "Pick a framework:",
      [
        "Next.js",
        "Nuxt",
        "SvelteKit",
        "Remix",
        "Astro",
        "Qwik",
        "SolidStart",
        "Gatsby",
        "Vite",
      ],
      { columns: 3 }, // 🔥 3 Kolom
    );
    this.success(`Selected: ${framework}`);

    // TEST 3: STANDARD LIST (Default)
    this.log(chalk.bold.white("\n--- Test 3: Standard List (Fallback) ---"));
    const mode = await promptSelectV2(
      "Confirm action:",
      ["Deploy to Prod", "Deploy to Staging", "Cancel"],
      { columns: 1 }, // Default
    );
    this.info(`Action: ${mode}`);
  }
}

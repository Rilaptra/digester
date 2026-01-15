import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { Select } from "../utils/tui/Select.js"; // 🔥 IMPORT BARU

export class TestCommand extends BaseCommand {
  public name = "test";
  public description = "Demo of the new SELECT Class";
  public aliases = ["demo"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🎮 SELECT COMPONENT DEMO");

    // --- CASE 1: Selecting Action (Generic Object) ---
    interface Action {
      id: string;
      risk: "LOW" | "HIGH";
    }

    const action = await new Select<Action>()
      .title("What should we do next?")
      .add(
        "Deploy to Production",
        { id: "deploy", risk: "HIGH" },
        {
          desc: "Push code to vercel",
          icon: "🚀",
          color: chalk.green,
        }
      )
      .add(
        "Run Tests",
        { id: "test", risk: "LOW" },
        {
          desc: "Run comprehensive suite",
          icon: "🧪",
          color: chalk.cyan,
        }
      )
      .separator() // 🔥 Pemisah visual
      .add(
        "Delete Database",
        { id: "nuke", risk: "HIGH" },
        {
          desc: "Do not touch this",
          icon: "💀",
          color: chalk.red,
          // disabled: true, // 🔥 Disabled state
        }
      )
      .run();

    this.success(`Selected ID: ${action.id} (Risk: ${action.risk})`);

    // --- CASE 2: Grid Selection (Simple String) ---
    const lang = await new Select<string>()
      .title("Pick your poison:")
      .columns(3) // 🔥 Grid Mode
      .add("TypeScript", "ts", { icon: "🟦", color: chalk.blueBright })
      .add("JavaScript", "js", { icon: "🟨", color: chalk.yellow })
      .add("Rust", "rs", { icon: "🦀", color: chalk.red })
      .add("Go", "go", { icon: "🐹", color: chalk.cyan })
      .add("Python", "py", { icon: "🐍", color: chalk.green })
      .add("C++", "cpp", { icon: "𝓒", color: chalk.blue })
      .add("Zig", "zig", { icon: "⚡", color: chalk.blue })
      .run();

    this.success(`Language: ${lang.toUpperCase()}`);
  }
}

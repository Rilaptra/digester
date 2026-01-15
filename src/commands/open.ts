import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import * as Utils from "../utils/index.js";

export class OpenCommand extends BaseCommand {
  public name = "open";
  public description =
    "Open source code or specific files in your preferred editor or file manager.";
  public aliases = ["o", "code", "start"];

  public async execute(args: string[]): Promise<void> {
    let app = args[0];

    if (!app) {
      const selection = await this.promptSelectV2(
        "Where do you want to open the source code?",
        ["System Default", "Visual Studio Code", "Explorer", "Cancel"],
        { columns: 2 }
      );

      if (selection === "Cancel") {
        this.info("Operation canceled.");
        return;
      }

      // Map selection to app keyword
      const map: Record<string, string> = {
        "System Default": "system",
        "Visual Studio Code": "vscode",
        Explorer: "explorer",
      };
      app = map[selection];
    }

    const lowerApp = app.toLowerCase();

    const apps = {
      vscode: ["code", "vscode", "code.exe", "vscode.exe"],
      explorer: [
        "explorer",
        "explorer.exe",
        "xp",
        "file",
        "files",
        "native",
        "windows",
        "win",
        "dir",
        ".",
      ],
    };

    if (apps.vscode.includes(lowerApp)) {
      const spinner = this.spinner(
        chalk.cyan("📂 Opening Source Code Using Visual Studio Code...")
      );
      try {
        Bun.spawnSync(["code", SYSTEM.ROOT_DIR], {
          stdio: ["ignore", "ignore", "ignore"], // Detach output to avoid clutter
        });
        spinner.succeed("Opened Source Code Using Visual Studio Code");
      } catch (e) {
        spinner.fail(chalk.red("Failed to open VS Code. Is it installed?"));
      }
      return;
    }

    if (apps.explorer.includes(lowerApp)) {
      const spinner = this.spinner(
        chalk.cyan("📂 Opening Source Code in Explorer...")
      );
      Bun.spawnSync(["explorer", SYSTEM.ROOT_DIR]);
      spinner.succeed("Opened Source Code folder");
      return;
    }

    // Default / System Open (matches "system" from map or unknown args)
    if (lowerApp === "system" || !app) {
      this.log(chalk.cyan("📂 Opening source code..."));
      Utils.openFile(SYSTEM.ROOT_DIR);
      return;
    }

    this.warn(`Unknown application: ${app}. Trying to system open...`);
    Bun.spawnSync(["explorer", SYSTEM.ROOT_DIR]);
  }
}

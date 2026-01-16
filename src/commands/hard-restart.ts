import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { generateLog } from "../utils/logger.js";

export class HardRestartCommand extends BaseCommand {
  public name = "hard-restart";
  public description =
    "Force a complete rebuild and restart of the CLI tool to apply latest changes.";
  public aliases = ["restart", "res", "hr", "r", "rebuild", "rb", "f5"];

  public async execute(_args: string[]): Promise<void> {
    const selection = await this.promptSelectV2(
      chalk.redBright("🛑 Are you sure you want to restart current build?"),
      ["Yes", "No"],
      { allowCustom: false, columns: 2 },
    );
    if (selection === "No") {
      this.info("Aborted");
      return;
    }
    try {
      this.info("Rebuilding...");
      Bun.spawnSync(["bun", "run", "build"], {
        cwd: SYSTEM.ROOT_DIR,
        stdio: ["inherit", "inherit", "inherit"],
      });
      this.success("✔ Rebuilt");
    } catch (error) {
      this.error("Failed to rebuild");
      generateLog({ type: "error", raw: true }, error);
    }
  }
}

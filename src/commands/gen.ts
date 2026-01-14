import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { promptText } from "../utils/prompts.js";

export class GenCommand extends BaseCommand {
  public name = "gen";
  public description = "Scaffold new Commands or Managers quickly";
  public aliases = ["create", "scaffold", "new"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🏗️  CODE SCAFFOLDER");

    const type = await this.promptSelectV2("👉 What do you want to create?", [
      "Command (src/commands)",
      "Manager (src/managers)",
    ]);

    const nameRaw = await promptText(
      chalk.yellow(`👉 Enter ${type} name (e.g. 'Deploy'): `),
    );
    if (!nameRaw) return;

    // Normalization: "Deploy" -> "deploy", "MyFeature" -> "my-feature"
    const kebabName = nameRaw
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase();
    // ClassName: "deploy" -> "DeployCommand"
    const className =
      nameRaw.charAt(0).toUpperCase() +
      nameRaw.slice(1) +
      (type === "Command (src/commands)" ? "Command" : "Manager");
    const fileName = `${kebabName}.ts`;

    let content = "";
    let targetDir = "";

    if (type.startsWith("Command")) {
      targetDir = join(SYSTEM.ROOT_DIR, "src", "commands");
      content = `import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";

export class ${className} extends BaseCommand {
  public name = "${kebabName}";
  public description = "TODO: Add description";
  public aliases = [];

  public async execute(args: string[]): Promise<void> {
    this.createBox("${className} Running");
    this.log("Executing ${kebabName}...");
    
    // Your logic here
    this.success("Done!");
  }
}
`;
    } else {
      targetDir = join(SYSTEM.ROOT_DIR, "src", "managers");
      content = `/** biome-ignore-all lint/complexity/noStaticOnlyClass: Manager is static */
export class ${className} {
  static async init() {
    // TODO: Init logic
  }
}
`;
    }

    const filePath = join(targetDir, fileName);

    if (await Bun.file(filePath).exists()) {
      this.error(`❌ File already exists: ${fileName}`);
      return;
    }

    await Bun.write(filePath, content);
    this.success(`✅ Created: ${chalk.bold(fileName)}`);
    this.dim(`   Path: ${filePath}`);

    if (type.startsWith("Command")) {
      this.info("💡 Tip: Run 'bun run codegen' to register the new command.");
    }
  }
}

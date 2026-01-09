import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { AIManager } from "../managers/AIManager.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import { GitManager } from "../managers/GitManager.js";
import { generateLog } from "../utils/logger.js";

export class CommitCommand extends BaseCommand {
  public name = "commit";
  public description = "AI Auto-Commit, Changelog & Tag";
  public aliases = ["ci"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🤖 AUTO OPS AGENT (SELF-UPDATE)");
    this.dim(`Target Repo: ${SYSTEM.ROOT_DIR}`);

    const auth = await ConfigManager.getAuth();
    if (!auth.apiKey) {
      this.error("API Key missing. Run 'digest set-key <YOUR_KEY>' first.");
      process.exit(1);
    }

    const spinner = this.spinner("Checking internal changes...");
    const diff = await GitManager.prepareAndGetDiff();

    if (!diff || diff.trim().length === 0) {
      spinner.fail(
        chalk.yellow("No internal changes detected in Digester repo."),
      );
      process.exit(0);
    }

    spinner.text = `Consulting ${auth.model || "Gemini"}...`;

    try {
      const result = await AIManager.generateCommitDetails(diff, auth);
      spinner.stop();

      generateLog({ type: "info", raw: true }, chalk.bold("\n📝 AI Proposal:"));
      generateLog(
        { type: "info", raw: true },
        `   ${chalk.cyan("Message")} : ${result.commitMessage}`,
      );
      generateLog(
        { type: "info", raw: true },
        `   ${chalk.green("Bump")}    : ${result.bump.toUpperCase()}`,
      );
      generateLog(
        { type: "info", raw: true },
        `   ${chalk.yellow("Log")}     : ${result.changelog}\n`,
      );

      const confirm = await this.promptYesNo(
        `${chalk.bgBlue.black(" EXECUTE ")} Commit & Push? ${chalk.dim(
          "(Y/n)",
        )} `,
      );

      if (confirm) {
        // 1. Update Version
        let newVer = null;
        if (result.bump !== "none") {
          newVer = await GitManager.updateVersion(result.bump);
          if (newVer)
            this.success(`Updated internal package.json to v${newVer}`);
        }

        // 2. Update Changelog
        const changelogPath = join(SYSTEM.ROOT_DIR, "CHANGELOG.md");
        let currentContent = "";
        if (await Bun.file(changelogPath).exists()) {
          currentContent = await Bun.file(changelogPath).text();
        } else {
          currentContent = "# Changelog\n\n";
        }

        const date = new Date().toISOString().split("T")[0];
        const versionHeader = newVer
          ? `## [${newVer}] - ${date}`
          : `### [${date}]`;
        const entry = `\n${versionHeader}\n- ${result.changelog}\n`;

        // Prepend logic: find the first occurrence of "# Changelog" and insert after it
        const header = "# Changelog\n";
        let newContent = "";
        if (currentContent.includes(header)) {
          newContent = currentContent.replace(header, `${header}${entry}`);
        } else {
          newContent = `${header}${entry}${currentContent.replace("# Changelog", "")}`;
        }

        await Bun.write(changelogPath, `${newContent.trim()}\n`);

        Bun.spawnSync(["git", "add", "CHANGELOG.md"], {
          cwd: SYSTEM.ROOT_DIR,
        });
        this.success(`Updated internal CHANGELOG.md`);

        // 3. Commit & Tag
        await GitManager.executeCommit(
          result.commitMessage,
          newVer || undefined,
        );

        // 4. 🔥 AUTO PUSH
        await GitManager.pushToRemote();

        generateLog(
          { type: "success", raw: true },
          chalk.bgGreen.black("\n 🎉 DONE (Committed & Pushed) "),
        );
      } else {
        this.dim("Aborted.");
      }
    } catch (e) {
      spinner.fail(chalk.red(`AI Error: ${(e as Error).message}`));
    }
  }
}

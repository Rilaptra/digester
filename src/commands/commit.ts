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

  public async execute(args: string[]): Promise<void> {
    // 🔥 FIX 1: Default selalu CWD. Pakai 'self' kalau mau edit core CLI
    const isSelf = args[0] === "self";
    const targetDir = isSelf ? SYSTEM.ROOT_DIR : process.cwd();
    const modeLabel = isSelf ? "SELF-UPDATE" : "CURRENT DIR";

    this.createBox(`🤖 AUTO OPS AGENT (${modeLabel})`);

    // Safety Check
    if (!targetDir) {
      this.error("❌ Target directory is undefined.");
      process.exit(1);
    }
    this.dim(`Target Repo: ${targetDir}`);

    // --- 1. Git Initialization Check ---
    if (!GitManager.isRepo(targetDir)) {
      this.warn("⚠️  This directory is not a Git repository.");
      const doInit = await this.promptYesNo(
        `${chalk.bold("Initialize Git")} in this directory now?`,
      );
      if (doInit) {
        if (await GitManager.init(targetDir))
          this.success("✅ Git initialized successfully.");
        else {
          this.error("❌ Failed to initialize Git.");
          process.exit(1);
        }
      } else {
        this.error("Aborted. Digester requires a git repository.");
        process.exit(1);
      }
    }

    // --- 2. Remote Configuration Check ---
    if (!(await GitManager.hasRemote(targetDir))) {
      this.warn("⚠️  No remote repository configured.");
      const addRemote = await this.promptYesNo(
        `${chalk.bold("Add a Remote Origin")} to push your code?`,
      );
      if (addRemote) {
        const url = await this.promptText(chalk.cyan("👉 Enter Remote URL: "));
        if (url && url.length > 5) {
          if (await GitManager.addRemote(targetDir, url))
            this.success("✅ Remote 'origin' added.");
          else this.error("❌ Failed to add remote.");
        } else this.warn("Skipping remote setup.");
      }
    }

    // --- 3. Diff & AI Generation ---
    const auth = await ConfigManager.getAuth();
    if (!auth.apiKey) {
      this.error("API Key missing. Run 'digest set-key <YOUR_KEY>' first.");
      process.exit(1);
    }

    const spinner = this.spinner("Checking local changes...");
    const diff = await GitManager.prepareAndGetDiff(targetDir);

    if (!diff || diff.trim().length === 0) {
      spinner.fail(chalk.yellow("No changes detected to commit."));
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

      // --- SECRET CHECK ---
      if (result.checkResult && !result.checkResult.isSafe) {
        generateLog(
          { type: "warn", raw: true },
          chalk.bgRed.white.bold(" 🛡️  SECURITY WARNING "),
        );
        generateLog(
          { type: "warn", raw: true },
          `   ${chalk.red(result.checkResult.message)}\n`,
        );
        const proceed = await this.promptYesNo(
          `${chalk.bold("SENSITIVE DATA DETECTED.")} Continue anyway?`,
        );
        if (!proceed) {
          this.error("Process aborted.");
          return;
        }
      }

      const confirm = await this.promptYesNo(
        `${chalk.bgBlue.black(" EXECUTE ")} Commit these changes? ${chalk.dim("(Y/n)")}`,
      );
      if (!confirm) {
        this.dim("Aborted.");
        return;
      }

      // --- 4. Execution ---
      let newVer: string | null = null;
      if (result.bump !== "none") {
        newVer = await GitManager.updateVersion(result.bump, targetDir);
        if (newVer) this.success(`Updated package.json to v${newVer}`);
      }

      // Update Changelog
      const changelogPath = join(targetDir, "CHANGELOG.md");
      const currentContent = (await Bun.file(changelogPath).exists())
        ? await Bun.file(changelogPath).text()
        : "# Changelog\n\n";

      const date = new Date().toISOString().split("T")[0];
      const versionHeader = newVer
        ? `## [${newVer}] - ${date}`
        : `### [${date}]`;

      const formattedLines = result.changelog
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .map((l) => (l.startsWith("-") || l.startsWith("*") ? l : `- ${l}`));

      const entry = `\n${versionHeader}\n${formattedLines.join("\n")}\n`;
      const header = "# Changelog\n";
      const newContent = currentContent.includes(header)
        ? currentContent.replace(header, `${header}${entry}`)
        : `${header}${entry}${currentContent.replace("# Changelog", "")}`;

      await Bun.write(changelogPath, `${newContent.trim()}\n`);
      Bun.spawnSync(["git", "add", "CHANGELOG.md"], { cwd: targetDir });

      // 🔥 FIX 2: Update README hanya kalau ini source Digester
      if (newVer && isSelf) {
        await GitManager.updateReadmeVersion(newVer, targetDir);
        await GitManager.updateReadmeCommands(targetDir);
      }

      // --- PRE-PUSH SCRIPTS ---
      if (!isSelf) {
        const config = await ConfigManager.load(targetDir);
        let scriptsToRun = config.prePushScripts || [];

        if (scriptsToRun.length === 0) {
          const availableScripts =
            await ConfigManager.getAvailableScripts(targetDir);
          const availableTS = await ConfigManager.listTSFiles(targetDir);
          if (availableScripts.length > 0 || availableTS.length > 0) {
            const options = [
              ...availableScripts.map((s) => `[script] ${s}`),
              ...availableTS.map((t) => `[ts-file] ${t}`),
            ];
            const selected = await this.promptMultiSelect(
              chalk.cyan(
                "\n🔍 Pre-push: Select scripts/TS files to run (optional):",
              ),
              options,
            );
            if (selected.length > 0) scriptsToRun = selected;
          }
        }

        if (scriptsToRun.length > 0) {
          this.createBox("🚀 PRE-PUSH PIPELINE");
          for (const item of scriptsToRun) {
            const isTS = item.startsWith("[ts-file]") || item.endsWith(".ts");
            const cleanItem = item
              .replace("[script] ", "")
              .replace("[ts-file] ", "");
            let retry = true;
            while (retry) {
              const scriptSpinner = this.spinner(
                `Running: ${chalk.bold(cleanItem)}...`,
              );
              try {
                const cmd = isTS
                  ? ["bun", cleanItem]
                  : ["bun", "run", cleanItem];
                const proc = Bun.spawn(cmd, { cwd: targetDir, stderr: "pipe" });
                if ((await proc.exited) === 0) {
                  scriptSpinner.succeed(`Success: ${cleanItem}`);
                  retry = false;
                } else {
                  scriptSpinner.fail(
                    `Failed: ${cleanItem}\n${chalk.red(await new Response(proc.stderr).text())}`,
                  );
                  const action = await this.promptSelectV2(
                    chalk.red("What next?"),
                    ["Retry", "Continue anyway", "Abort"],
                    { columns: 1 },
                  );
                  if (action === "Abort") {
                    this.error("Aborted.");
                    process.exit(1);
                  }
                  if (action === "Continue anyway") retry = false;
                }
              } catch (error) {
                scriptSpinner.fail(`Error: ${(error as Error).message}`);
                if (await this.promptYesNo("Abort process?")) process.exit(1);
                retry = false;
              }
            }
          }
        }
      } else {
        this.createBox("🏗️  AUTO-BUILD PIPELINE (SELF-UPDATE)");
        const buildSpinner = this.spinner("Compiling Digester binary...");
        try {
          const buildProc = Bun.spawn(["bun", "run", "build"], {
            cwd: targetDir,
            stderr: "pipe",
          });
          if ((await buildProc.exited) === 0) {
            buildSpinner.succeed("Build success!");
            Bun.spawnSync(["git", "add", "dist"], { cwd: targetDir });
          } else {
            buildSpinner.fail(`Build failed.`);
            if (!(await this.promptYesNo(chalk.red("Continue anyway?"))))
              process.exit(1);
          }
        } catch (error) {
          buildSpinner.fail(`Error: ${(error as Error).message}`);
        }
      }

      await GitManager.executeCommit(
        result.commitMessage,
        newVer || undefined,
        targetDir,
      );

      // --- 5. Push Strategy ---
      const pushStrategy = await this.promptSelectV2(
        "🚀 How should we push these changes?",
        [
          "Direct Push (Current Branch)",
          "Create PR Branch (New Branch)",
          "Skip Push",
        ],
        { columns: 1 },
      );

      if (pushStrategy === "Skip Push") {
        this.success("Commit saved locally. Done!");
        return;
      }

      if (pushStrategy === "Create PR Branch (New Branch)") {
        const branchName = await this.promptText(
          chalk.cyan("👉 Enter new branch name: "),
        );
        const cleanName = branchName.trim().replace(/\s+/g, "-");
        if (cleanName.length > 0) {
          const spinnerBranch = this.spinner(`Creating branch ${cleanName}...`);
          if (await GitManager.createBranch(targetDir, cleanName)) {
            spinnerBranch.succeed(`Switched to branch '${cleanName}'`);
            await GitManager.pushToRemote(targetDir, cleanName);
          } else {
            spinnerBranch.fail("Failed to create branch. Pushing to current.");
            await GitManager.pushToRemote(targetDir);
          }
        } else {
          this.warn("Invalid branch name. Pushing to current branch.");
          await GitManager.pushToRemote(targetDir);
        }
      } else {
        await GitManager.pushToRemote(targetDir);
      }

      generateLog(
        { type: "success", raw: true },
        chalk.bgGreen.black("\n 🎉 ALL SET! "),
      );
    } catch (e) {
      spinner.fail(chalk.red(`AI Error: ${(e as Error).message}`));
    }
  }
}

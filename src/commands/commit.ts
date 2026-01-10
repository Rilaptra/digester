import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { AIManager } from "../managers/AIManager.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import { GitManager } from "../managers/GitManager.js";
import { promptText } from "../utils/index.js";
import { generateLog } from "../utils/logger.js";

export class CommitCommand extends BaseCommand {
  public name = "commit";
  public description = "AI Auto-Commit, Changelog & Tag";
  public aliases = ["ci"];

  public async execute(args: string[]): Promise<void> {
    const isThis = args[0] === "this";
    // Jika 'this', targetnya CWD. Jika kosong, targetnya ROOT_DIR (Repo Digester sendiri)
    const targetDir = isThis ? process.cwd() : SYSTEM.ROOT_DIR;
    const modeLabel = isThis ? "CURRENT DIR" : "SELF-UPDATE";

    this.createBox(`🤖 AUTO OPS AGENT (${modeLabel})`);

    // Safety Check: Pastikan targetDir valid
    if (!targetDir) {
      this.error("❌ Target directory is undefined. Check SYSTEM.ROOT_DIR.");
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
        if (await GitManager.init(targetDir)) {
          this.success("✅ Git initialized successfully initialized.");
        } else {
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
        const url = await promptText(
          chalk.cyan("👉 Enter Remote URL (e.g., git@github.com:u/repo.git): "),
        );
        if (url && url.length > 5) {
          if (await GitManager.addRemote(targetDir, url)) {
            this.success("✅ Remote 'origin' added successfully.");
          } else {
            this.error("❌ Failed to add remote.");
          }
        } else {
          this.warn("Skipping remote setup (invalid URL).");
        }
      }
    }

    // --- 2.5 Auto-Release Workflow Check ---
    const releaseYmlPath = join(
      targetDir,
      ".github",
      "workflows",
      "release.yml",
    );
    // Cek file async style Bun
    if (!(await Bun.file(releaseYmlPath).exists())) {
      const createWorkflow = await this.promptYesNo(
        `${chalk.bold("Create GitHub Release Workflow")} (.github/workflows/release.yml)?`,
      );

      if (createWorkflow) {
        const template = `name: Release
on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
`;
        try {
          const { mkdirSync } = await import("node:fs");
          mkdirSync(join(targetDir, ".github", "workflows"), {
            recursive: true,
          });
          await Bun.write(releaseYmlPath, template);
          Bun.spawnSync(["git", "add", ".github/workflows/release.yml"], {
            cwd: targetDir,
          });
          this.success("✅ Created release.yml workflow.");
        } catch (e) {
          this.warn(
            `Failed to create release workflow: ${(e as Error).message}`,
          );
        }
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

      const confirm = await this.promptYesNo(
        `${chalk.bgBlue.black(" EXECUTE ")} Commit these changes? ${chalk.dim(
          "(Y/n)",
        )} `,
      );

      if (!confirm) {
        this.dim("Aborted.");
        return;
      }

      // --- 4. Execution ---

      // Update Version (if applicable)
      let newVer: string | null = null;
      if (result.bump !== "none") {
        newVer = await GitManager.updateVersion(result.bump, targetDir);
        if (newVer) this.success(`Updated package.json to v${newVer}`);
      }

      // Update Changelog (Logic Multiline Support)
      const changelogPath = join(targetDir, "CHANGELOG.md");
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

      const rawLines = result.changelog.split("\n");
      const formattedLines = rawLines
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          if (line.startsWith("-") || line.startsWith("*")) {
            return line;
          }
          return `- ${line}`;
        });

      const entry = `\n${versionHeader}\n${formattedLines.join("\n")}\n`;
      const header = "# Changelog\n";
      let newContent = "";
      if (currentContent.includes(header)) {
        newContent = currentContent.replace(header, `${header}${entry}`);
      } else {
        newContent = `${header}${entry}${currentContent.replace("# Changelog", "")}`;
      }

      await Bun.write(changelogPath, `${newContent.trim()}\n`);

      Bun.spawnSync(["git", "add", "CHANGELOG.md"], {
        cwd: targetDir,
      });

      // --- 🔥 NEW FEATURE: AUTO-BUILD (Before Commit) ---
      // Logic: Build hanya dijalankan jika mode Self-Update (!isThis)
      // Jadi kalau 'digest commit this', dia SKIP langkah ini.
      if (!isThis) {
        this.createBox("🏗️  AUTO-BUILD PIPELINE");
        const buildSpinner = this.spinner("Compiling Digester binary...");

        try {
          // Kita jalanin 'bun run build' sesuai script di package.json
          // Pastikan cwd-nya adalah SYSTEM.ROOT_DIR
          const buildProc = Bun.spawn(["bun", "run", "build"], {
            cwd: targetDir, // Harus di root digester
            stderr: "pipe",
          });

          const exitCode = await buildProc.exited;
          const stderr = await new Response(buildProc.stderr).text();

          if (exitCode === 0) {
            buildSpinner.succeed("Build success! (dist/index.js updated)");

            // Jangan lupa 'git add dist' karena file dist berubah
            Bun.spawnSync(["git", "add", "dist"], { cwd: targetDir });
          } else {
            buildSpinner.fail(`Build failed:\n${stderr}`);

            const ignoreBuild = await this.promptYesNo(
              chalk.red("Build failed. Continue commit anyway?"),
            );
            if (!ignoreBuild) {
              this.error("Process aborted due to build failure.");
              process.exit(1);
            }
          }
        } catch (error) {
          buildSpinner.fail(
            `Build execution error: ${(error as Error).message}`,
          );
          // Optional: Abort or Continue logic here
        }
      } else {
        // Feedback visual bahwa build di-skip karena mode 'Current Dir'
        this.dim("ℹ️  Skipping auto-build (Target is external directory).");
      }

      // --- Commit & Tag ---
      await GitManager.executeCommit(
        result.commitMessage,
        newVer || undefined,
        targetDir,
      );

      // --- 5. Push Strategy ---
      const pushStrategy = await this.promptSelect(
        "🚀 How should we push these changes?",
        [
          "Direct Push (Current Branch)",
          "Create PR Branch (New Branch)",
          "Skip Push",
        ],
      );

      if (pushStrategy === "Skip Push") {
        this.success("Commit saved locally. Done!");
        return;
      }

      if (pushStrategy === "Create PR Branch (New Branch)") {
        const branchName = await promptText(
          chalk.cyan("👉 Enter new branch name (e.g. feat/new-ui): "),
        );

        const cleanName = branchName.trim().replace(/\s+/g, "-");
        if (cleanName.length > 0) {
          const spinnerBranch = this.spinner(`Creating branch ${cleanName}...`);
          const created = await GitManager.createBranch(targetDir, cleanName);
          if (!created) {
            spinnerBranch.fail(
              "Failed to create branch. Pushing to current instead.",
            );
            await GitManager.pushToRemote(targetDir);
          } else {
            spinnerBranch.succeed(`Switched to branch '${cleanName}'`);
            await GitManager.pushToRemote(targetDir, cleanName);
          }
        } else {
          this.warn("Invalid branch name. Pushing to current branch.");
          await GitManager.pushToRemote(targetDir);
        }
      } else {
        // Direct Push
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

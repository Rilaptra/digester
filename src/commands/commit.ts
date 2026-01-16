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
        `${chalk.bold("Initialize Git")} in this directory now?`
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
        `${chalk.bold("Add a Remote Origin")} to push your code?`
      );

      if (addRemote) {
        const url = await this.promptText(
          chalk.cyan("👉 Enter Remote URL (e.g., git@github.com:u/repo.git): ")
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

    // --- 2.5 Auto-Release Workflow Check (INTERACTIVE) ---
    const releaseYmlPath = join(
      targetDir,
      ".github",
      "workflows",
      "release.yml"
    );

    // Cek dulu filenya ada apa nggak
    if (!(await Bun.file(releaseYmlPath).exists())) {
      const createWorkflow = await this.promptYesNo(
        `${chalk.bold(
          "Create GitHub Release Workflow"
        )} (.github/workflows/release.yml)?`
      );

      if (createWorkflow) {
        // 🔥 FITUR BARU: PILIH TIPE WORKFLOW 🔥
        const workflowType = await this.promptSelectV2(
          "📦 Select Release Workflow Type:",
          [
            "Standard (Source Code Release Only)",
            "Binary Build (Cross-Platform Compile + Release)",
          ],
          { columns: 1 }
        );

        let template = "";

        // TIPE 1: STANDARD (Cuma release source code, ringan)
        if (workflowType.startsWith("Standard")) {
          template = `name: Release Source
on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    name: 🚀 Publish Release
    runs-on: ubuntu-latest
    steps:
      - name: 📥 Checkout Code
        uses: actions/checkout@v4

      - name: 🎉 Create Release
        uses: softprops/action-gh-release@v1
        with:
          generate_release_notes: true
`;
        }
        // TIPE 2: BINARY BUILD (Buat Digester / CLI Tools)
        else {
          template = `name: Build & Release Binaries 🚀

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  build-and-release:
    name: 🏗️ Build & Release
    runs-on: ubuntu-latest

    steps:
      - name: 📥 Checkout Code
        uses: actions/checkout@v4

      - name: 🍞 Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: 📦 Install Dependencies
        run: bun install

      # Build Binary untuk 4 Platform
      - name: 🪟 Build Windows
        run: bun build ./src/index.ts --compile --target=bun-windows-x64 --outfile dist/myapp-win-x64.exe

      - name: 🐧 Build Linux
        run: bun build ./src/index.ts --compile --target=bun-linux-x64 --outfile dist/myapp-linux-x64

      - name: 🍎 Build macOS (Silicon)
        run: bun build ./src/index.ts --compile --target=bun-darwin-arm64 --outfile dist/myapp-macos-arm64

      - name: 🍎 Build macOS (Intel)
        run: bun build ./src/index.ts --compile --target=bun-darwin-x64 --outfile dist/myapp-macos-x64

      - name: 🎉 Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/myapp-win-x64.exe
            dist/myapp-linux-x64
            dist/myapp-macos-arm64
            dist/myapp-macos-x64
          generate_release_notes: true
`;
        }

        try {
          const { mkdirSync } = await import("node:fs");
          mkdirSync(join(targetDir, ".github", "workflows"), {
            recursive: true,
          });
          await Bun.write(releaseYmlPath, template);
          Bun.spawnSync(["git", "add", ".github/workflows/release.yml"], {
            cwd: targetDir,
          });

          const label = workflowType.startsWith("Standard")
            ? "Standard"
            : "Binary-Build";
          this.success(`✅ Created '${label}' release workflow.`);
        } catch (e) {
          this.warn(
            `Failed to create release workflow: ${(e as Error).message}`
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
        `   ${chalk.cyan("Message")} : ${result.commitMessage}`
      );
      generateLog(
        { type: "info", raw: true },
        `   ${chalk.green("Bump")}    : ${result.bump.toUpperCase()}`
      );
      generateLog(
        { type: "info", raw: true },
        `   ${chalk.yellow("Log")}     : ${result.changelog}\n`
      );

      // --- 🔥 NEW FEATURE: SECRET CHECK ---
      if (result.checkResult && !result.checkResult.isSafe) {
        generateLog(
          { type: "warn", raw: true },
          chalk.bgRed.white.bold(" 🛡️  SECURITY WARNING ")
        );
        generateLog(
          { type: "warn", raw: true },
          `   ${chalk.red(result.checkResult.message)}\n`
        );

        const proceed = await this.promptYesNo(
          `${chalk.bold("SENSITIVE DATA DETECTED.")} Continue anyway?`
        );
        if (!proceed) {
          this.error("Process aborted for security reasons.");
          return;
        }
      }

      const confirm = await this.promptYesNo(
        `${chalk.bgBlue.black(" EXECUTE ")} Commit these changes? ${chalk.dim(
          "(Y/n)"
        )} `
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
        newContent = `${header}${entry}${currentContent.replace(
          "# Changelog",
          ""
        )}`;
      }

      await Bun.write(changelogPath, `${newContent.trim()}\n`);

      Bun.spawnSync(["git", "add", "CHANGELOG.md"], {
        cwd: targetDir,
      });

      // --- 🔥 NEW FEATURE: PRE-PUSH SCRIPTS (Before Push Strategy) ---
      if (isThis) {
        const config = await ConfigManager.load(targetDir);
        let scriptsToRun = config.prePushScripts || [];

        // If no scripts configured, ask user if they want to run any
        if (scriptsToRun.length === 0) {
          const availableScripts = await ConfigManager.getAvailableScripts(
            targetDir
          );
          const availableTS = await ConfigManager.listTSFiles(targetDir);

          if (availableScripts.length > 0 || availableTS.length > 0) {
            const options = [
              ...availableScripts.map((s) => `[script] ${s}`),
              ...availableTS.map((t) => `[ts-file] ${t}`),
            ];

            const selected = await this.promptMultiSelect(
              chalk.cyan(
                "\n🔍 Pre-push: Select scripts/TS files to run (optional):"
              ),
              options
            );

            if (selected.length > 0) {
              scriptsToRun = selected;
            }
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
                `Running: ${chalk.bold(cleanItem)}...`
              );

              try {
                const cmd = isTS
                  ? ["bun", cleanItem]
                  : ["bun", "run", cleanItem];
                const proc = Bun.spawn(cmd, {
                  cwd: targetDir,
                  stderr: "pipe",
                });

                const exitCode = await proc.exited;
                const stderr = await new Response(proc.stderr).text();

                if (exitCode === 0) {
                  scriptSpinner.succeed(`Success: ${cleanItem}`);
                  retry = false;
                } else {
                  scriptSpinner.fail(
                    `Failed: ${cleanItem}\n${chalk.red(stderr)}`
                  );

                  const action = await this.promptSelectV2(
                    chalk.red(`Script '${cleanItem}' failed. What next?`),
                    ["Retry", "Continue anyway", "Abort"],
                    { columns: 1 }
                  );

                  if (action === "Abort") {
                    this.error("Process aborted by user.");
                    process.exit(1);
                  } else if (action === "Continue anyway") {
                    retry = false;
                  }
                  // if "Retry", retry remains true and loop continues
                }
              } catch (error) {
                scriptSpinner.fail(
                  `Execution error: ${(error as Error).message}`
                );
                const exit = await this.promptYesNo("Abort process?");
                if (exit) process.exit(1);
                retry = false;
              }
            }
          }
        }
      } else {
        // --- EXISTING: SELF-UPDATE AUTO-BUILD ---
        this.createBox("🏗️  AUTO-BUILD PIPELINE (SELF-UPDATE)");
        const buildSpinner = this.spinner("Compiling Digester binary...");

        try {
          const buildProc = Bun.spawn(["bun", "run", "build"], {
            cwd: targetDir,
            stderr: "pipe",
          });

          const exitCode = await buildProc.exited;
          const stderr = await new Response(buildProc.stderr).text();

          if (exitCode === 0) {
            buildSpinner.succeed("Build success!");
            Bun.spawnSync(["git", "add", "dist"], { cwd: targetDir });
          } else {
            buildSpinner.fail(`Build failed:\n${stderr}`);
            if (!(await this.promptYesNo(chalk.red("Continue anyway?")))) {
              process.exit(1);
            }
          }
        } catch (error) {
          buildSpinner.fail(`Error: ${(error as Error).message}`);
        }
      }

      // --- Commit & Tag ---
      await GitManager.executeCommit(
        result.commitMessage,
        newVer || undefined,
        targetDir
      );

      // --- 5. Push Strategy ---
      const pushStrategy = await this.promptSelectV2(
        "🚀 How should we push these changes?",
        [
          "Direct Push (Current Branch)",
          "Create PR Branch (New Branch)",
          "Skip Push",
        ],
        { columns: 1 }
      );

      if (pushStrategy === "Skip Push") {
        this.success("Commit saved locally. Done!");
        return;
      }

      if (pushStrategy === "Create PR Branch (New Branch)") {
        const branchName = await this.promptText(
          chalk.cyan("👉 Enter new branch name (e.g. feat/new-ui): ")
        );

        const cleanName = branchName.trim().replace(/\s+/g, "-");
        if (cleanName.length > 0) {
          const spinnerBranch = this.spinner(`Creating branch ${cleanName}...`);
          const created = await GitManager.createBranch(targetDir, cleanName);
          if (!created) {
            spinnerBranch.fail(
              "Failed to create branch. Pushing to current instead."
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
        chalk.bgGreen.black("\n 🎉 ALL SET! ")
      );
    } catch (e) {
      spinner.fail(chalk.red(`AI Error: ${(e as Error).message}`));
    }
  }
}

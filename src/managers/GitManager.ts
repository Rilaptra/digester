/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: GitManager is a static class> */

import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { generateLog } from "../utils/logger.js";

/**
 * Manages Git operations and repository interactions.
 * Handles diff generation, versioning, commits, remote management, and README updates.
 */
export class GitManager {
  /**
   * Prepares the repository and retrieves a clean Git diff.
   * Automatically initializes Git if not found and stages all changes.
   *
   * @param targetDir - The root directory of the Git repository. Defaults to SYSTEM.ROOT_DIR.
   * @returns A promise that resolves to a filtered, optimized diff string.
   */
  static async prepareAndGetDiff(
    targetDir: string = SYSTEM.ROOT_DIR,
  ): Promise<string> {
    try {
      const gitDir = join(targetDir, ".git");

      if (!existsSync(gitDir)) {
        generateLog(
          { type: "warn" },
          chalk.yellow(
            `⚠️  Git not found in tool dir (${targetDir}). Initializing...`,
          ),
        );
        Bun.spawnSync(["git", "init"], { cwd: targetDir });
      }

      // Add changes to staging
      Bun.spawnSync(["git", "add", "."], { cwd: targetDir });

      const proc = Bun.spawn(["git", "diff", "--cached", "-U0"], {
        cwd: targetDir,
      });

      const rawDiff = await new Response(proc.stdout).text();

      const cleanDiff = rawDiff
        .split("\n")
        .filter((line) => {
          if (line.startsWith("diff --git")) return true;
          if (line.startsWith("+") && !line.startsWith("+++")) return true;
          if (line.startsWith("-") && !line.startsWith("---")) return true;
          return false;
        })
        .join("\n");

      return cleanDiff;
    } catch {
      return "";
    }
  }

  /**
   * Updates the version in package.json and stages the change.
   * Supports major, minor, and patch bumps.
   *
   * @param bumpType - The type of version bump ('major', 'minor', 'patch', or 'none').
   * @param targetDir - The root directory containing package.json. Defaults to SYSTEM.ROOT_DIR.
   * @returns A promise that resolves to the new version string or null if failed.
   */
  static async updateVersion(
    bumpType: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ): Promise<string | null> {
    // Assuming ROOT_DIR is where package.json lives
    const pkgPath = join(targetDir, "package.json");
    const file = Bun.file(pkgPath);
    if (!(await file.exists())) return null;

    try {
      const pkg = await file.json();
      const oldVer = pkg.version || "0.0.0";

      // Regex to split "13.0.0-ai" -> ["13", "0", "0", "-ai"] or "1.2.3" -> ["1", "2", "3", undefined]
      const match = oldVer.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
      if (!match) return null;

      const [_, majorStr, minorStr, patchStr, suffix] = match;
      let major = Number(majorStr);
      let minor = Number(minorStr);
      let patch = Number(patchStr);

      if (bumpType === "major") {
        major++;
        minor = 0;
        patch = 0;
      } else if (bumpType === "minor") {
        minor++;
        patch = 0;
      } else if (bumpType === "patch") {
        patch++;
      } else return oldVer;

      const newVer = `${major}.${minor}.${patch}${suffix || ""}`;
      pkg.version = newVer;
      await Bun.write(pkgPath, JSON.stringify(pkg, null, 2));

      Bun.spawnSync(["git", "add", "package.json"], {
        cwd: targetDir,
      });
      return newVer;
    } catch {
      return null;
    }
  }

  /**
   * Executes a Git commit with an optional tag.
   *
   * @param msg - The commit message.
   * @param tag - Optional version tag (e.g., '1.0.0').
   * @param targetDir - The root directory of the Git repository. Defaults to SYSTEM.ROOT_DIR.
   * @throws Error if the Git commit process fails.
   */
  static async executeCommit(
    msg: string,
    tag?: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ) {
    try {
      const commitProc = Bun.spawn(["git", "commit", "-m", msg], {
        cwd: targetDir,
        stdio: ["inherit", "inherit", "inherit"],
      });
      await commitProc.exited;

      if (tag) {
        const tagProc = Bun.spawn(["git", "tag", `v${tag}`], {
          cwd: targetDir,
          stdio: ["inherit", "inherit", "inherit"],
        });
        await tagProc.exited;
        generateLog({ type: "success" }, chalk.green(`   🏷️  Tagged v${tag}`));
      }
    } catch (e) {
      generateLog({ type: "error" }, chalk.red("❌ Git commit failed."));
      throw e;
    }
  }

  // --- 🛠️ CORE CHECKS & INIT ---

  /**
   * Checks if a directory is a Git repository.
   *
   * @param dir - The directory to check.
   * @returns True if a .git directory exists.
   */
  static isRepo(dir: string): boolean {
    return existsSync(join(dir, ".git"));
  }

  /**
   * Initializes a new Git repository in the specified directory.
   *
   * @param dir - The directory to initialize.
   * @returns A promise that resolves to true if successful.
   */
  static async init(dir: string): Promise<boolean> {
    try {
      Bun.spawnSync(["git", "init"], { cwd: dir });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks if the Git repository has any remotes configured.
   *
   * @param dir - The directory of the Git repository.
   * @returns A promise that resolves to true if at least one remote exists.
   */
  static async hasRemote(dir: string): Promise<boolean> {
    try {
      const proc = Bun.spawn(["git", "remote"], { cwd: dir });
      const text = await new Response(proc.stdout).text();
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Adds a remote origin to the Git repository.
   *
   * @param dir - The directory of the Git repository.
   * @param url - The remote repository URL.
   * @returns A promise that resolves to true if successfully added and verified.
   */
  static async addRemote(dir: string, url: string): Promise<boolean> {
    try {
      Bun.spawnSync(["git", "remote", "add", "origin", url], { cwd: dir });
      // Verify it worked
      return await GitManager.hasRemote(dir);
    } catch {
      return false;
    }
  }

  /**
   * Retrieves the current Git branch name.
   *
   * @param dir - The directory of the Git repository.
   * @returns A promise that resolves to the current branch name, defaults to 'main'.
   */
  static async getCurrentBranch(dir: string): Promise<string> {
    try {
      const proc = Bun.spawn(["git", "branch", "--show-current"], { cwd: dir });
      return (await new Response(proc.stdout).text()).trim() || "main";
    } catch {
      return "main";
    }
  }

  /**
   * Creates and switches to a new Git branch.
   *
   * @param dir - The directory of the Git repository.
   * @param branchName - The name of the new branch.
   * @returns A promise that resolves to true if successful.
   */
  static async createBranch(dir: string, branchName: string): Promise<boolean> {
    try {
      // checkout -b
      const proc = Bun.spawn(["git", "checkout", "-b", branchName], {
        cwd: dir,
      });
      await proc.exited;
      return true;
    } catch {
      return false;
    }
  }

  // --- 🔥 AUTO PUSH FUNCTION ---
  /**
   * Pushes the current branch and tags to the remote origin.
   *
   * @param targetDir - The root directory of the Git repository. Defaults to SYSTEM.ROOT_DIR.
   * @param branchName - Optional branch name to push. Defaults to the current branch.
   */
  static async pushToRemote(
    targetDir: string = SYSTEM.ROOT_DIR,
    branchName?: string,
  ) {
    const branch = branchName || (await GitManager.getCurrentBranch(targetDir));
    generateLog(
      { type: "info" },
      chalk.yellow(`\n🚀 Pushing to remote origin/${branch}...`),
    );
    try {
      // Push specific branch and tags
      const proc = Bun.spawn(
        ["git", "push", "-u", "origin", `${branch}:${branch}`, "--tags"],
        {
          cwd: targetDir,
          stdio: ["inherit", "inherit", "inherit"],
        },
      );
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        generateLog({ type: "success" }, chalk.green("   ✅ Push Success!"));
      } else {
        throw new Error(`Push failed with exit code ${exitCode}`);
      }
    } catch (_e) {
      generateLog({ type: "error" }, chalk.red("\n❌ Push Failed."));
      generateLog(
        { type: "info" },
        chalk.dim(
          "   Check your internet, remote permission, or 'git remote -v'.",
        ),
      );
    }
  }

  /**
   * Updates the version badge in README.md.
   * Searches for a shields.io version badge and replaces it with the new version.
   * If the badge is not found, it attempts to inject it after the H1 header.
   *
   * @param newVer - The new version string to display in the badge.
   * @param targetDir - The root directory containing README.md. Defaults to SYSTEM.ROOT_DIR.
   */
  static async updateReadmeVersion(
    newVer: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ) {
    const readmePath = join(targetDir, "README.md");
    const readmeFile = Bun.file(readmePath);

    if (!(await readmeFile.exists())) return;

    try {
      let content = await readmeFile.text();

      const safeVer = newVer.replace(/-/g, "--"); // Escape dash for URL
      const regex =
        /(!\[.*Version.*\]\(https:\/\/img\.shields\.io\/badge\/Version-)(.+?)(-blue)/;

      if (regex.test(content)) {
        // Replace existing badge
        content = content.replace(regex, `$1${safeVer}$3`);
      } else {
        const badge = `![Version](https://img.shields.io/badge/Version-${safeVer}-blue?style=for-the-badge)`;

        const headerRegex = /^(# .+$)/m;
        if (headerRegex.test(content)) {
          content = content.replace(headerRegex, `$1\n\n${badge}`);
        } else {
          content = `${badge}\n\n${content}`;
        }
      }

      await Bun.write(readmePath, content);

      // Auto add to git staging
      Bun.spawnSync(["git", "add", "README.md"], { cwd: targetDir });
      generateLog(
        { type: "success" },
        `   📄 Updated README badge to v${newVer}`,
      );
    } catch (e) {
      generateLog(
        { type: "warn" },
        `Failed to update README: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Automatically updates the commands reference table in README.md.
   * Scans the commands directory, extracts metadata from command files, and generates a markdown table.
   *
   * @param targetDir - The root directory of the project. Defaults to SYSTEM.ROOT_DIR.
   */
  static async updateReadmeCommands(targetDir: string = SYSTEM.ROOT_DIR) {
    const commandsDir = join(targetDir, "src", "commands");
    const readmePath = join(targetDir, "README.md");
    const readmeFile = Bun.file(readmePath);

    if (!(await readmeFile.exists()) || !(await Bun.file(commandsDir).exists()))
      return;

    try {
      // 1. Scan & Parse Command Files
      const files = await readdir(commandsDir);
      const rows: string[] = [];

      for (const file of files) {
        if (
          !file.endsWith(".ts") ||
          file.endsWith(".test.ts") ||
          file === "index.ts"
        )
          continue;

        const content = await Bun.file(join(commandsDir, file)).text();

        // 🧠 Lightweight Regex Parsing (No need for heavy AST)
        // Extract: public name = "..."
        const nameMatch = content.match(/public\s+name\s*=\s*["'](.+?)["']/);
        // Extract: public description = "..."
        const descMatch = content.match(
          /public\s+description\s*=\s*["'](.+?)["']/,
        );
        // Extract: public aliases = ["...", "..."]
        const aliasMatch = content.match(
          /public\s+aliases\s*(?::\s*string\[\])?\s*=\s*\[(.*?)\]/,
        );

        if (nameMatch) {
          const name = nameMatch[1];
          const desc = descMatch ? descMatch[1] : "No description";

          let aliases = "-";
          if (aliasMatch && aliasMatch[1].trim() !== "") {
            // Clean up: "a", "b" -> a, b
            aliases = aliasMatch[1]
              .split(",")
              .map((a) => a.trim().replace(/["']/g, ""))
              .filter((a) => a.length > 0)
              .map((a) => `\`${a}\``)
              .join(", ");
          }

          // Format Row: | `name` | `alias`, `alias` | Description |
          rows.push(`| \`${name}\` | ${aliases} | ${desc} |`);
        }
      }

      // Sort alphabetic
      rows.sort();

      // 2. Build New Table
      const header = "| Command | Alias | Description |";
      const separator = "| :--- | :--- | :--- |";
      const newTable = `${header}\n${separator}\n${rows.join("\n")}`;

      // 3. Inject to README
      let readmeContent = await readmeFile.text();

      const sectionRegex =
        /(## 🎮 Commands Reference\n\n)([\s\S]*?)(\n\n##|\n\n---|$)/;

      if (sectionRegex.test(readmeContent)) {
        readmeContent = readmeContent.replace(sectionRegex, `$1${newTable}$3`);

        await Bun.write(readmePath, readmeContent);

        // Add to Git Staging
        Bun.spawnSync(["git", "add", "README.md"], { cwd: targetDir });
        generateLog(
          { type: "success" },
          `   📚 Updated README commands table (${rows.length} cmds)`,
        );
      } else {
        generateLog(
          { type: "warn" },
          `   ⚠️  Header '## 🎮 Commands Reference' not found in README. Table update skipped.`,
        );
      }
    } catch (e) {
      generateLog(
        { type: "error" },
        `Failed to update README commands: ${(e as Error).message}`,
      );
    }
  }
}

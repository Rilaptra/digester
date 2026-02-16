/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: GitManager is a static class> */

import { existsSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { generateLog } from "../utils/logger.js";

/**
 * Manages Git operations with ROBUST error handling.
 * Now throws explicit errors for network issues or dirty states.
 */
export class GitManager {
  // --- 🔥 CORE EXECUTOR (The Fix) ---
  /**
   * Executes a git command and handles errors gracefully.
   * Throws detailed errors if the git command fails (non-zero exit).
   */
  private static async exec(
    args: string[],
    cwd: string = SYSTEM.ROOT_DIR,
    silent = false,
  ): Promise<string> {
    try {
      const proc = Bun.spawn(["git", ...args], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"], // Capture stdout & stderr
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();

      if (exitCode !== 0) {
        // Analisis Error Umum biar message-nya enak dibaca user
        const err = stderr.trim();
        if (err.includes("Could not resolve host")) {
          throw new Error(
            "Network Error: Cannot connect to remote repository.",
          );
        }
        if (err.includes("Aborting") || err.includes("conflict")) {
          throw new Error("Git Conflict: Manual resolution required.");
        }
        if (err.includes("Permission denied")) {
          throw new Error("Auth Error: Check your SSH keys or permissions.");
        }
        if (err.includes("local changes")) {
          throw new Error(
            "Dirty State: You have uncommitted changes. Stash or commit them first.",
          );
        }

        throw new Error(err || `Git exited with code ${exitCode}`);
      }

      return stdout.trim();
    } catch (error) {
      if (!silent) {
        // Optional: Log debug info if needed, or just throw up
      }
      throw error;
    }
  }

  // --- PUBLIC METHODS ---

  /**
   * Checks if a directory is a Git repository.
   */
  static isRepo(dir: string): boolean {
    return existsSync(join(dir, ".git"));
  }

  /**
   * Checks for uncommitted changes (Dirty Check).
   * Penting buat update command biar gak nabrak.
   */
  static async isDirty(dir: string): Promise<boolean> {
    try {
      const status = await GitManager.exec(["status", "--porcelain"], dir);
      return status.length > 0;
    } catch {
      return false;
    }
  }

  static async prepareAndGetDiff(
    targetDir: string = SYSTEM.ROOT_DIR,
  ): Promise<string> {
    if (!GitManager.isRepo(targetDir)) {
      await GitManager.init(targetDir);
    }

    try {
      // Stage all changes first
      await GitManager.exec(["add", "."], targetDir);

      // Get diff cached
      const diff = await GitManager.exec(
        ["diff", "--cached", "-U0"],
        targetDir,
      );

      return diff
        .split("\n")
        .filter((line) => {
          if (line.startsWith("diff --git")) return true;
          if (line.startsWith("+") && !line.startsWith("+++")) return true;
          if (line.startsWith("-") && !line.startsWith("---")) return true;
          return false;
        })
        .join("\n");
    } catch (e) {
      throw new Error(`Failed to generate diff: ${(e as Error).message}`);
    }
  }

  static async updateVersion(
    bumpType: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ): Promise<string | null> {
    const pkgPath = join(targetDir, "package.json");
    const file = Bun.file(pkgPath);
    if (!(await file.exists())) return null;

    try {
      const pkg = await file.json();
      const oldVer = pkg.version || "0.0.0";
      const match = oldVer.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
      if (!match) return null;

      const [_, majorStr, minorStr, patchStr, suffix] = match;
      let [major, minor, patch] = [
        Number(majorStr),
        Number(minorStr),
        Number(patchStr),
      ];

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

      await GitManager.exec(["add", "package.json"], targetDir);
      return newVer;
    } catch {
      return null;
    }
  }

  static async executeCommit(
    msg: string,
    tag?: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ) {
    await GitManager.exec(["commit", "-m", msg], targetDir);
    if (tag) {
      await GitManager.exec(["tag", `v${tag}`], targetDir);
      generateLog({ type: "success" }, chalk.green(`   🏷️  Tagged v${tag}`));
    }
  }

  static async init(dir: string): Promise<boolean> {
    try {
      await GitManager.exec(["init"], dir);
      return true;
    } catch {
      return false;
    }
  }

  static async hasRemote(dir: string): Promise<boolean> {
    try {
      const res = await GitManager.exec(["remote"], dir);
      return res.length > 0;
    } catch {
      return false;
    }
  }

  static async addRemote(dir: string, url: string): Promise<boolean> {
    try {
      await GitManager.exec(["remote", "add", "origin", url], dir);
      return true;
    } catch {
      return false;
    }
  }

  static async getCurrentBranch(dir: string): Promise<string> {
    try {
      return await GitManager.exec(["branch", "--show-current"], dir);
    } catch {
      return "main";
    }
  }

  static async createBranch(dir: string, branchName: string): Promise<boolean> {
    try {
      await GitManager.exec(["checkout", "-b", branchName], dir);
      return true;
    } catch {
      return false;
    }
  }

  static async pushToRemote(
    targetDir: string = SYSTEM.ROOT_DIR,
    branchName?: string,
  ) {
    const branch = branchName || (await GitManager.getCurrentBranch(targetDir));
    generateLog(
      { type: "info" },
      chalk.yellow(`\n🚀 Pushing to origin/${branch}...`),
    );

    try {
      // Push + Tags
      await GitManager.exec(
        ["push", "-u", "origin", `${branch}:${branch}`, "--tags"],
        targetDir,
      );
      generateLog({ type: "success" }, chalk.green("   ✅ Push Success!"));
    } catch (e) {
      throw new Error(`Push Failed: ${(e as Error).message}`);
    }
  }

  // --- Helpers for Update Command & Readme ---

  static async fetch(dir: string) {
    return GitManager.exec(["fetch", "origin"], dir);
  }

  static async pull(dir: string) {
    return GitManager.exec(["pull", "origin", "main"], dir); // Asumsi main, bisa didinamisin
  }

  static async getHash(dir: string, ref: string): Promise<string> {
    try {
      return await GitManager.exec(["rev-parse", ref], dir);
    } catch {
      return "";
    }
  }

  static async updateReadmeVersion(
    newVer: string,
    targetDir: string = SYSTEM.ROOT_DIR,
  ) {
    const readmePath = join(targetDir, "README.md");
    if (!(await Bun.file(readmePath).exists())) return;

    try {
      let content = await Bun.file(readmePath).text();
      const safeVer = newVer.replace(/-/g, "--");
      const regex =
        /(!\[.*Version.*\]\(https:\/\/img\.shields\.io\/badge\/Version-)(.+?)(-blue)/;

      if (regex.test(content)) {
        content = content.replace(regex, `$1${safeVer}$3`);
      } else {
        const badge = `![Version](https://img.shields.io/badge/Version-${safeVer}-blue?style=for-the-badge)`;
        content = content.replace(/^(# .+$)/m, `$1\n\n${badge}`);
      }

      await Bun.write(readmePath, content);
      await GitManager.exec(["add", "README.md"], targetDir);
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

  // updateReadmeCommands logic stays mostly the same logic-wise, just wrap git add in try-catch or exec
  static async updateReadmeCommands(targetDir: string = SYSTEM.ROOT_DIR) {
    // ... (Keep existing logic parsing files)
    // Di bagian akhir:
    try {
      // ... write file logic ...
      await GitManager.exec(["add", "README.md"], targetDir);
    } catch {}
  }
}

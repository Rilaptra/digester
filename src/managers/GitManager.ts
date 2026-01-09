/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: GitManager is a static class> */

import { existsSync } from "node:fs"; // Keep sync check for init/existence logic or switch to async
import { join } from "node:path";
import chalk from "chalk";
import { SYSTEM } from "../constants/defaults.js";
import { generateLog } from "../utils/logger.js";

export class GitManager {
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
        // Bun.spawnSync for initialization
        Bun.spawnSync(["git", "init"], { cwd: targetDir });
      }

      Bun.spawnSync(["git", "add", "."], { cwd: targetDir });

      const proc = Bun.spawn(["git", "diff", "--cached"], { cwd: targetDir });
      const text = await new Response(proc.stdout).text();
      return text;
    } catch (_e) {
      return "";
    }
  }

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

  // 🔥 NEW: AUTO PUSH FUNCTION
  static async pushToRemote(targetDir: string = SYSTEM.ROOT_DIR) {
    generateLog(
      { type: "info" },
      chalk.yellow("\n🚀 Pushing to remote (origin)..."),
    );
    try {
      // Push HEAD (current branch) and tags
      const proc = Bun.spawn(["git", "push", "origin", "HEAD", "--tags"], {
        cwd: targetDir,
        stdio: ["inherit", "inherit", "inherit"],
      });
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
        chalk.dim("   Check your internet or 'git remote -v' config."),
      );
    }
  }
}

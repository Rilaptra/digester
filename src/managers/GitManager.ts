/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: GitManager is a static class> */

import { existsSync } from "node:fs"; // Keep sync check for init/existence logic or switch to async
import { readdir } from "node:fs/promises";
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
        Bun.spawnSync(["git", "init"], { cwd: targetDir });
      }

      // Add changes to staging
      Bun.spawnSync(["git", "add", "."], { cwd: targetDir });

      // 🔥 OPTIMIZATION START HERE
      // Pake -U0 biar context lines-nya 0 (hemat token parah)
      const proc = Bun.spawn(["git", "diff", "--cached", "-U0"], {
        cwd: targetDir,
      });

      const rawDiff = await new Response(proc.stdout).text();

      // Filter: Cuma ambil Header File, Tambahan (+), dan Hapus (-)
      // Kita buang metadata git kayak "index abc..def" atau "@@ -1,0 ..."
      const cleanDiff = rawDiff
        .split("\n")
        .filter((line) => {
          // Keep file headers biar AI tau ini file apa
          if (line.startsWith("diff --git")) return true;
          // Keep additions & deletions
          if (line.startsWith("+") && !line.startsWith("+++")) return true;
          if (line.startsWith("-") && !line.startsWith("---")) return true;
          return false;
        })
        .join("\n");

      return cleanDiff;
      // 🔥 OPTIMIZATION END
    } catch {
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

  // --- 🛠️ CORE CHECKS & INIT ---

  static isRepo(dir: string): boolean {
    return existsSync(join(dir, ".git"));
  }

  static async init(dir: string): Promise<boolean> {
    try {
      Bun.spawnSync(["git", "init"], { cwd: dir });
      return true;
    } catch {
      return false;
    }
  }

  static async hasRemote(dir: string): Promise<boolean> {
    try {
      const proc = Bun.spawn(["git", "remote"], { cwd: dir });
      const text = await new Response(proc.stdout).text();
      return text.trim().length > 0;
    } catch {
      return false;
    }
  }

  static async addRemote(dir: string, url: string): Promise<boolean> {
    try {
      Bun.spawnSync(["git", "remote", "add", "origin", url], { cwd: dir });
      // Verify it worked
      return await GitManager.hasRemote(dir);
    } catch {
      return false;
    }
  }

  static async getCurrentBranch(dir: string): Promise<string> {
    try {
      const proc = Bun.spawn(["git", "branch", "--show-current"], { cwd: dir });
      return (await new Response(proc.stdout).text()).trim() || "main";
    } catch {
      return "main";
    }
  }

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
   * Update README.md version badge.
   * Finds format: ![Version](https://img.shields.io/badge/Version-X.Y.Z--ai-blue?style=for-the-badge)
   * and replaces X.Y.Z with newVer.
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

      // Regex untuk nyari badge version.
      // Kita cari pattern shields.io standard.
      // E.g., ![Version](https://img.shields.io/badge/Version-16.7.0--ai-blue?style=for-the-badge)
      // Note: Shields.io pake double dash (--) buat escape dash (-).

      const safeVer = newVer.replace(/-/g, "--"); // Escape dash for URL
      const regex =
        /(!\[.*Version.*\]\(https:\/\/img\.shields\.io\/badge\/Version-)(.+?)(-blue)/;

      if (regex.test(content)) {
        // Replace existing badge
        content = content.replace(regex, `$1${safeVer}$3`);
      } else {
        // Kalau badge belum ada, kita inject di bawah Title H1
        const badge = `![Version](https://img.shields.io/badge/Version-${safeVer}-blue?style=for-the-badge)`;

        // Cari posisi setelah header # Digester CLI
        // Kita inject di baris baru setelah header line
        const headerRegex = /^(# .+$)/m;
        if (headerRegex.test(content)) {
          content = content.replace(headerRegex, `$1\n\n${badge}`);
        } else {
          // Fallback prepend
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
   * 🔥 AUTOMATIC README COMMANDS TABLE GENERATOR 🔥
   * Scans src/commands/*.ts, extracts metadata via Regex, and updates README.md table.
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
              .map((a) => `\`${a}\``) // Kasih backtick biar gaya
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

      // Regex buat nyari section Commands Reference
      // Kita cari header "## 🎮 Commands Reference" sampai ketemu header berikutnya atau separator
      // Pake [\s\S]*? buat match multiline non-greedy
      const sectionRegex =
        /(## 🎮 Commands Reference\n\n)([\s\S]*?)(\n\n##|\n\n---|$)/;

      if (sectionRegex.test(readmeContent)) {
        // Replace konten tabel yang lama dengan yang baru
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

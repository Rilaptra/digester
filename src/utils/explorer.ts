import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import chalk from "chalk";
import { generateLog } from "./logger.js";
import { Select } from "./tui/Select.js";

/**
 * Interactive File Explorer to select a single file.
 * Uses promptSelectV2 for grid/list navigation.
 *
 * @param {string} startDir - Directory to start browsing (default: CWD).
 * @param {string} rootDir - Project root to prevent going too far up (optional).
 * @returns {Promise<string | null>} Absolute path of the selected file, or null if aborted.
 */
export async function promptFileExplorer(
  startDir: string = process.cwd(),
  rootDir: string = process.cwd(),
): Promise<string | null> {
  let currentDir = startDir;

  while (true) {
    // 1. Visual Header
    const relPath = relative(rootDir, currentDir) || ".";
    generateLog(
      { type: "info", raw: true, noContext: true },
      chalk.bgBlue.white.bold(` 📂 BROWSE: ${relPath} `),
    );

    // 2. Get Directory Content
    let entries: Dirent[];
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      generateLog({ type: "error" }, `Access denied: ${currentDir}`);
      currentDir = dirname(currentDir); // Fallback up
      continue;
    }

    // 3. Prepare Options
    // Logic: Sort Folders first, then Files.
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, type: "dir" }));

    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith("."))
      .map((e) => ({ name: e.name, type: "file" }));

    // Sort alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    // 4. Interactive Prompt
    // Use columns=2 for compact view if many items, else 1
    const columns = folders.length + files.length > 10 ? 2 : 1;

    const select = new Select<string>()
      .title("Select a file or navigate:")
      .columns(columns);

    // Add "Go Back"
    select.add(".. (Up Level)", ".. (Up Level)");

    folders.forEach((f) => {
      select.add(`📂 ${f.name}/`, `📂 ${f.name}/`);
    });
    files.forEach((f) => {
      select.add(`📄 ${f.name}`, `📄 ${f.name}`);
    });
    select.add("❌ Cancel", "❌ Cancel");

    const selection = await select.run();

    // 5. Handle Selection
    if (selection === "❌ Cancel") return null;

    if (selection === ".. (Up Level)") {
      currentDir = join(currentDir, "..");
      continue;
    }

    if (selection.startsWith("📂")) {
      // Enter directory
      const folderName = selection.replace("📂 ", "").replace("/", "");
      currentDir = join(currentDir, folderName);
      continue;
    }

    if (selection.startsWith("📄")) {
      // File selected! Return absolute path
      const fileName = selection.replace("📄 ", "");
      return join(currentDir, fileName);
    }
  }
}

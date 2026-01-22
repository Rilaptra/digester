import { readdir, stat } from "node:fs/promises";
import { join, parse, relative } from "node:path";
import chalk from "chalk";
// Import logger langsung dari src
import { generateLog } from "../src/utils/logger.js";

// --- CONFIGURATION ---
const ROOT_DIR = process.cwd();
const COMMANDS_DIR = join(ROOT_DIR, "src/commands");
const OUTPUT_FILE = join(COMMANDS_DIR, "index.ts");

// --- UTILS ---
const formatDuration = (ms: number) => `${ms.toFixed(2)}ms`;

async function generateRegistry() {
  const start = performance.now();

  // Header Log
  generateLog(
    { type: "info", raw: true },
    chalk.bold.cyan("\n🤖 DIGESTER REGISTRY GEN\n"),
  );

  try {
    // 1. Validate Directory
    if (
      !(await Bun.file(COMMANDS_DIR).exists()) &&
      !(await isDir(COMMANDS_DIR))
    ) {
      throw new Error(`Directory not found: ${COMMANDS_DIR}`);
    }

    generateLog(
      { type: "info" },
      `Scanning directory: ${chalk.yellow("src/commands")}`,
    );

    // 2. Scan & Filter Files
    const files = await readdir(COMMANDS_DIR);
    const validCommands: string[] = [];
    const ignoredFiles: string[] = [];

    for (const file of files) {
      // Skip index.ts itself and definition files
      if (file === "index.ts" || file.endsWith(".d.ts")) continue;

      // Filter: Only .ts files, exclude tests/specs
      if (
        file.endsWith(".ts") &&
        !file.endsWith(".test.ts") &&
        !file.endsWith(".spec.ts")
      ) {
        validCommands.push(file);
      } else {
        ignoredFiles.push(file);
      }
    }

    if (validCommands.length === 0) {
      generateLog({ type: "error" }, "No valid commands found!");
      process.exit(1);
    }

    validCommands.sort(); // Sort alphabetic for consistency

    // 3. Generate Content
    const exportStatements = validCommands
      .map((f) => {
        const name = parse(f).name;
        // DX: Show what's being registered (Dimmed)
        generateLog({ type: "info", noContext: true }, chalk.dim(`+ ${name}`));
        return `export * from "./${name}.js";`;
      })
      .join("\n");

    const fileContent = `// 🤖 AUTO-GENERATED REGISTRY
// 📅 Generated at: ${new Date().toISOString()}
// ⚠️ DO NOT EDIT MANUALLY - Run 'bun run codegen' instead

${exportStatements}
`;

    // 4. Write to Disk
    await Bun.write(OUTPUT_FILE, fileContent);

    // 5. Final Stats
    const duration = performance.now() - start;
    generateLog({ type: "info", raw: true }, ""); // Spacer

    generateLog(
      { type: "success" },
      `Registry updated at ${chalk.bold(relative(ROOT_DIR, OUTPUT_FILE))}`,
    );

    // Stats Tableish
    generateLog(
      { type: "info", raw: true },
      chalk.gray("----------------------------------------"),
    );
    generateLog(
      { type: "info", raw: true },
      `  📦 Commands   : ${chalk.green(validCommands.length)}`,
    );
    generateLog(
      { type: "info", raw: true },
      `  🚫 Ignored    : ${chalk.yellow(ignoredFiles.length)}`,
    );
    generateLog(
      { type: "info", raw: true },
      `  ⚡ Time       : ${chalk.cyan(formatDuration(duration))}`,
    );
    generateLog(
      { type: "info", raw: true },
      chalk.gray("----------------------------------------\n"),
    );
  } catch (error) {
    generateLog(
      { type: "error" },
      `Generation failed: ${(error as Error).message}`,
    );
    process.exit(1);
  }
}

// Helper safely check dir
async function isDir(path: string) {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

// Execute
generateRegistry();

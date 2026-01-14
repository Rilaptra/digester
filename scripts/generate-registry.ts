import chalk from "chalk";
import { readdir, stat } from "node:fs/promises";
import { join, relative, parse } from "node:path";

// --- CONFIGURATION ---
const ROOT_DIR = process.cwd();
const COMMANDS_DIR = join(ROOT_DIR, "src/commands");
const OUTPUT_FILE = join(COMMANDS_DIR, "index.ts");

// --- UTILS ---
const formatDuration = (ms: number) => `${ms.toFixed(2)}ms`;
const log = {
  info: (msg: string) => console.log(`${chalk.blue("ℹ")} ${msg}`),
  success: (msg: string) => console.log(`${chalk.green("✔")} ${msg}`),
  error: (msg: string) => console.error(`${chalk.red("✖")} ${msg}`),
  dim: (msg: string) => console.log(chalk.gray(`  ${msg}`)),
};

async function generateRegistry() {
  const start = performance.now();
  console.log(chalk.bold.cyan("\n🤖 DIGESTER REGISTRY GEN\n"));

  try {
    // 1. Validate Directory
    if (
      !(await Bun.file(COMMANDS_DIR).exists()) &&
      !(await isDir(COMMANDS_DIR))
    ) {
      throw new Error(`Directory not found: ${COMMANDS_DIR}`);
    }

    log.info(`Scanning directory: ${chalk.yellow("src/commands")}`);

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
      log.error("No valid commands found!");
      process.exit(1);
    }

    validCommands.sort(); // Sort alphabetic for consistency

    // 3. Generate Content
    // Note: We replace .ts with .js because Bun/TS output usually expects extensionless or .js in ESM imports
    // But for "export *", using "./Filename.js" is the standard for ESM TS projects.
    const exportStatements = validCommands
      .map((f) => {
        const name = parse(f).name;
        // DX: Show what's being registered
        log.dim(`+ ${name}`);
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
    console.log(""); // Spacer
    log.success(
      `Registry updated at ${chalk.bold(relative(ROOT_DIR, OUTPUT_FILE))}`,
    );

    // Stats Tableish
    console.log(chalk.gray("----------------------------------------"));
    console.log(`  📦 Commands   : ${chalk.green(validCommands.length)}`);
    console.log(`  🚫 Ignored    : ${chalk.yellow(ignoredFiles.length)}`);
    console.log(`  ⚡ Time       : ${chalk.cyan(formatDuration(duration))}`);
    console.log(chalk.gray("----------------------------------------\n"));
  } catch (error) {
    log.error(`Generation failed: ${(error as Error).message}`);
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

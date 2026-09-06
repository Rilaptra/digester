import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { SYSTEM } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import { Scanner } from "../core/Scanner.js";
import { AIManager } from "../managers/AIManager.js";
import { ConfigManager } from "../managers/ConfigManager.js";
import type {
  AIDigestSuggestion,
  ScanStats,
  TreeIgnoreMode,
} from "../types/index.js";
import * as UtilFunctions from "../utils/index.js";
import { generateLog } from "../utils/logger.js";

/**
 * 🔥 FIX NESTED FENCE: fence harus SELALU lebih panjang dari run
 * backtick terpanjang di dalam file. .md berisi ``` jadi aman.
 */
function fenceFor(text: string): string {
  let max = 2;
  for (const m of text.matchAll(/`+/g)) {
    if (m[0].length > max) max = m[0].length;
  }
  return "`".repeat(Math.max(3, max + 1));
}

export class ScanCommand extends BaseCommand {
  public name = "scan";
  public description =
    "Scan directory and generate digest (AI mode: direct file selection)";
  public aliases = [".", "run"];

  public async execute(args: string[]): Promise<void> {
    let targetPaths: string[] = [];

    if (args.length > 0) {
      targetPaths = args;
    } else {
      const mode = await this.promptSelectV2(
        chalk.cyan("🎯  Select Scan Mode:"),
        [
          "Full Scan (Current Directory)",
          "Custom Paths (Specific Folders/Files)",
          "🤖 AI Copilot (Select & Digest Files)", // ← BARU
        ],
        { columns: 1 },
      );

      if (mode.startsWith("🤖 AI Copilot")) {
        await this.runCopilotFlow();
        return;
      }

      if (mode.startsWith("Custom")) {
        const tree = new UtilFunctions.TreeSelect({
          title: "Select paths to scan:",
          rootDir: process.cwd(),
          multiSelect: true,
        });
        const result = await tree.run();

        if (Array.isArray(result) && result.length > 0) {
          targetPaths = result
            .map((p) => relative(process.cwd(), p).replace(/\\/g, "/"))
            .filter(Boolean);
        }

        if (targetPaths.length === 0) {
          this.warn("No paths selected. Defaulting to current directory.");
          targetPaths = ["."];
        }
      } else {
        targetPaths = ["."];
      }
    }

    await this.scanTargets(targetPaths);
  }

  /**
   * 🤖 AI COPILOT FLOW v2: AI + manual pick → digest LANGSUNG.
   * prompter.config.json nggak disentuh sama sekali.
   */
  private async runCopilotFlow(): Promise<void> {
    this.createBox("🤖 AI COPILOT DIGESTER", "Direct File Selection");

    const cwd = process.cwd();
    const auth = await ConfigManager.getAuth();

    if (!auth.apiKey) {
      this.error("❌ API Key missing. Run 'digest set-key <KEY>' first.");
      process.exit(1);
    }

    // 1. Ignore mode — HANYA menentukan tree yang dilihat AI (bukan config!)
    const ignoreModeSelect = await this.promptSelectV2(
      chalk.cyan("🌳 Tree for AI (Ignore Mode):"),
      [
        "Default (Follow .gitignore)",
        "Config Only (prompter.config.json)",
        "Both (Gitignore + Config)",
        "None (Scan Everything)",
      ],
      { columns: 1 },
    );

    let modeKey: TreeIgnoreMode = "gitignore";
    if (ignoreModeSelect.startsWith("Config")) modeKey = "config";
    else if (ignoreModeSelect.startsWith("Both")) modeKey = "both";
    else if (ignoreModeSelect.startsWith("None")) modeKey = "none";

    // 2. Clean tree
    const treeSpinner = this.spinner("Mapping project structure...");
    let tree: string[];
    try {
      tree = await Scanner.getCleanTree(cwd, modeKey);
      if (tree.length === 0) {
        treeSpinner.fail("No files found to analyze based on ignore mode.");
        return;
      }
      treeSpinner.succeed(`Mapped ${tree.length} entries.`);
    } catch (e) {
      treeSpinner.fail(`Failed to map tree: ${(e as Error).message}`);
      return;
    }

    // 3. Keyword
    const keyword = await this.promptText(
      chalk.cyan("🔍 Enter keyword/criteria (e.g. 'manager', 'auth'): "),
      "manager",
    );
    if (!keyword) {
      this.warn("Keyword is required. Aborted.");
      return;
    }

    // 4. AI select FILES (bukan config)
    const aiSpinner = this.spinner(`Consulting ${auth.model || "Gemini"}...`);
    let suggestion: AIDigestSuggestion;
    try {
      suggestion = await AIManager.suggestDigestFiles(tree, keyword, auth);
      aiSpinner.succeed("AI selection ready!");
    } catch (e) {
      aiSpinner.fail(`AI Error: ${(e as Error).message}`);
      return;
    }

    this.createBox(
      suggestion.reasoning || "No reasoning provided.",
      "AI Reasoning",
    );

    // 5. Validate matchedPaths
    const validPaths = suggestion.matchedPaths.filter((p) => tree.includes(p));

    if (validPaths.length === 0) {
      this.warn("⚠️ AI found no matching paths. Add files manually below.");
    } else {
      this.log(chalk.cyan(`\n📂 AI selected ${validPaths.length} files.`));
    }

    // ─── 🛠️ EDIT PHASE: tambah manual + remove ───
    let finalPaths = new Set<string>(validPaths);
    let editing = true;

    while (editing) {
      const action = await this.promptSelectV2(
        chalk.cyan(`🛠️ Edit Selection (${finalPaths.size} files):`),
        [
          "➕ Add files manually (browse file tree)",
          "⌨️ Add file by typing path",
          "➖ Remove files from selection",
          "👀 Preview current selection",
          "✅ Confirm & Digest Now",
          "❌ Abort",
        ],
        { columns: 1 },
      );

      if (action === "❌ Abort") {
        this.dim("Aborted. Nothing digested, config untouched.");
        return;
      }

      if (action === "✅ Confirm & Digest Now") {
        editing = false;
        break;
      }

      if (action === "➕ Add files manually (browse file tree)") {
        const treeSelect = new UtilFunctions.TreeSelect({
          title: "Space = select • Enter = confirm • Esc = cancel",
          rootDir: cwd,
          multiSelect: true,
        });
        const picked = await treeSelect.run();

        if (Array.isArray(picked) && picked.length > 0) {
          let added = 0;
          for (const abs of picked) {
            const rel = relative(cwd, abs).replace(/\\/g, "/");
            // Bebas nambah apapun (termasuk yang di-ignore config) —
            // digestFiles baca langsung, ignore rule nggak apply.
            if (rel && !finalPaths.has(rel)) {
              finalPaths.add(rel);
              added++;
            }
          }
          this.success(`   ✅ Added ${added} file(s).`);
        } else {
          this.dim("   No files added.");
        }
      }

      if (action === "⌨️ Add file by typing path") {
        const availableToAdd = tree.filter((p) => !finalPaths.has(p));
        if (availableToAdd.length === 0) {
          this.warn("All tree paths are already included.");
          continue;
        }

        const customPath = await this.promptAutoComplete(
          "Type or select path to add:",
          availableToAdd,
          { limit: 15 },
        );

        if (customPath && tree.includes(customPath)) {
          finalPaths.add(customPath);
          this.success(`   ✅ Added: ${chalk.bold(customPath)}`);
        } else if (customPath) {
          this.warn(`   ⚠️ Path "${customPath}" not found in tree. Ignored.`);
        }
      }

      if (action === "➖ Remove files from selection") {
        if (finalPaths.size === 0) {
          this.warn("No files to remove.");
          continue;
        }

        const multiSelect = new UtilFunctions.MultiSelect<string>()
          .title("Uncheck files to REMOVE (Space to toggle, Enter to confirm):")
          .columns(1)
          .pageSize(10);

        Array.from(finalPaths)
          .sort()
          .forEach((p) => multiSelect.add(p, p, { selected: true }));

        const keptPaths = await multiSelect.run();
        // 🔥 FIX: hitung SEBELUM reassign (dulu selalu 0)
        const removedCount = finalPaths.size - keptPaths.length;
        finalPaths = new Set(keptPaths);
        this.warn(`   🗑️ Removed ${removedCount} file(s).`);
      }

      if (action === "👀 Preview current selection") {
        this.createBox(
          Array.from(finalPaths)
            .sort()
            .map((p) => `  • ${p}`)
            .join("\n") || "(empty)",
          `Selection (${finalPaths.size})`,
        );
      }
    }

    // ─── 🚀 DIRECT DIGEST — zero config touched ───
    if (finalPaths.size === 0) {
      this.warn("No files selected. Aborted.");
      return;
    }
    await this.digestSelected(Array.from(finalPaths));
  }

  /** Digest daftar file eksplisit → reuse displayReport + writeOutput */
  private async digestSelected(paths: string[]): Promise<void> {
    const cwd = process.cwd();
    const projectName = await this.getProjectName(cwd);

    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    this.dim(`   Project: ${chalk.bold(projectName)}`);

    const spinner = this.spinner(
      `Digesting ${paths.length} selected file(s)...`,
    );
    const stats = await Scanner.digestFiles(cwd, paths);
    spinner.succeed(`Digested ${stats.files.length}/${paths.length} file(s).`);

    if (stats.files.length === 0) {
      this.error(
        "❌ No valid files to digest (missing, binary, or too large).",
      );
      return;
    }
    if (stats.skippedCount > 0) {
      this.warn(
        `   ⚠️ Skipped ${stats.skippedCount} file(s): missing, binary, or oversized.`,
      );
    }

    this.displayReport(stats);

    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write Digest File? ${chalk.dim("(Y/n)")} `,
    );

    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    await this.writeOutput(stats, projectName, "AI");
  }

  // 🔥 getProjectName — SAMA PERSIS (tidak diubah)
  private async getProjectName(root: string): Promise<string> {
    try {
      const gitConfigPath = join(root, ".git", "config");
      const gitConfigFile = Bun.file(gitConfigPath);

      if (await gitConfigFile.exists()) {
        const text = await gitConfigFile.text();
        const match = text.match(/url\s*=\s*.*\/([^/]+?)(\.git)?\s*$/m);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {
      // fallback ke folder name
    }
    return basename(root);
  }
  private async scanTargets(paths: string[]) {
    const aggregatedStats: ScanStats = {
      files: [],
      tree: [],
      skippedCount: 0,
      skippedSize: 0,
      totalSize: 0,
      extStats: {},
      duration: 0,
      forceIncludedCount: 0,
    };

    const startTime = performance.now();
    const projectRoot = process.cwd();

    // 🔥 Panggil Helper di sini
    const projectName = await this.getProjectName(projectRoot);
    const rootConfig = await ConfigManager.load(projectRoot);

    this.log(chalk.cyan(`\n⚡ PROMPTER v${SYSTEM.VERSION}`));
    this.dim(`   Project: ${chalk.bold(projectName)}`); // Kasih feedback ke user

    for (const path of paths) {
      const targetDir = UtilFunctions.resolvePath(path);
      if (!targetDir) {
        this.warn(`⚠️  Skipping invalid path: "${path}"`);
        continue;
      }

      // Hitung path relative untuk Tree & Header File
      const dirNameRelativeToRoot = relative(projectRoot, targetDir);

      const spinner = this.spinner(
        `Scanning ${chalk.bold(dirNameRelativeToRoot || ".")}...`,
      );

      const stats = await Scanner.run(targetDir, rootConfig);
      spinner.succeed(
        `Scanned ${dirNameRelativeToRoot || "Root"} (${
          stats.files.length
        } files)`,
      );

      // 🛠️ Update RelPath agar sesuai Project Root
      stats.files.forEach((f) => {
        f.relPath = relative(projectRoot, f.path);
      });
      aggregatedStats.files.push(...stats.files);

      // 🛠️ Tree Visual Enhancement
      if (dirNameRelativeToRoot && dirNameRelativeToRoot !== "") {
        aggregatedStats.tree.push(`📂 ${dirNameRelativeToRoot}/`);
      }
      aggregatedStats.tree.push(...stats.tree);

      // Merge Counters
      aggregatedStats.skippedCount += stats.skippedCount;
      aggregatedStats.skippedSize += stats.skippedSize;
      aggregatedStats.totalSize += stats.totalSize;

      for (const [ext, data] of Object.entries(stats.extStats)) {
        if (!aggregatedStats.extStats[ext]) {
          aggregatedStats.extStats[ext] = { count: 0, size: 0 };
        }
        aggregatedStats.extStats[ext].count += data.count;
        aggregatedStats.extStats[ext].size += data.size;
      }
    }

    aggregatedStats.duration = performance.now() - startTime;

    if (aggregatedStats.files.length === 0) {
      this.error("❌ No valid files found in selected targets.");
      return;
    }

    this.displayReport(aggregatedStats);

    const shouldWrite = await this.promptYesNo(
      `${chalk.bgCyan.black(" ACTION ")} Write Digest File? ${chalk.dim(
        "(Y/n)",
      )} `,
    );

    if (!shouldWrite) {
      this.dim("Cancelled");
      return;
    }

    // 🔥 Pake projectName yang udah kita dapet di awal
    await this.writeOutput(aggregatedStats, projectName);
  }

  // Display report ga berubah
  private displayReport(stats: ScanStats) {
    // (Kode sama persis seperti sebelumnya)
    generateLog({ type: "info", raw: true }, "");
    const table = new Table({
      head: [chalk.white("Metric"), chalk.white("Value")],
      colWidths: [20, 35],
    });
    table.push(
      [chalk.cyan("Total Files"), stats.files.length],
      [chalk.yellow("Context Size"), UtilFunctions.formatSize(stats.totalSize)],
      [
        chalk.magenta("Est. Tokens"),
        UtilFunctions.estimateTokens(stats.totalSize),
      ],
      [
        chalk.red("Skipped"),
        `${stats.skippedCount} files (${UtilFunctions.formatSize(
          stats.skippedSize,
        )})`,
      ],
      [chalk.dim("Duration"), `${stats.duration.toFixed(0)} ms`],
    );
    generateLog({ type: "info", raw: true }, table.toString());

    if (Object.keys(stats.extStats).length > 0) {
      generateLog(
        { type: "info", raw: true },
        `\n${chalk.dim("Distribution:")}`,
      );
      Object.entries(stats.extStats)
        .sort((a, b) => b[1].size - a[1].size)
        .slice(0, 5)
        .forEach(([ext, d]) => {
          const pct = ((d.size / stats.totalSize) * 100).toFixed(1);
          generateLog(
            { type: "info", raw: true },
            `  ${chalk.cyan(ext.padEnd(8))} : ${d.count
              .toString()
              .padEnd(5)} files | ${chalk.yellow(
              UtilFunctions.formatSize(d.size),
            )} (${pct}%)`,
          );
        });
    }
    generateLog({ type: "info", raw: true }, "");
  }
  // writeOutput — FIXED: nested fence + binary guard + await end + label
  private async writeOutput(stats: ScanStats, projectName: string, label = "") {
    const outPath = join(
      SYSTEM.OUT_DIR,
      `DIGEST_${projectName}${label ? `_${label}` : ""}_${Date.now()}.md`,
    );

    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    writer.write(
      `# Project Digest: ${projectName}${label ? ` (${label})` : ""}\n\n## Structure\n\`\`\`\n${stats.tree.join("\n")}\n\`\`\`\n\n## Code Content\n`,
    );

    const writeSpin = this.spinner("Writing to disk...");
    let done = 0;

    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);

      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            let text = await Bun.file(f.path).text();

            // 🛡️ Binary guard: null byte = bukan teks
            if (text.includes("")) {
              return `\n// --- ${f.relPath} (Skipped: binary file) ---\n`;
            }

            // 🔥 FIX #2: CRLF → LF (hemat token, output konsisten)
            text = text.replace(/\r\n/g, "\n");

            // 🔥 FIX #1: fence adaptif — .md berisi ``` nggak ngerusak struktur
            const fence = fenceFor(text);
            const lang = f.ext.replace(/^\./, "");
            return `\n// --- ${f.relPath} ---\n${fence}${lang}\n${text}\n${fence}\n`;
          } catch {
            return `\n// --- ${f.relPath} (Error Reading File) ---\n`;
          }
        }),
      );

      for (const c of contents) writer.write(c);

      done += chunk.length;
      writeSpin.text = `Writing ${Math.round(
        (done / stats.files.length) * 100,
      )}%`;
    }

    // 🔥 FIX: await end() biar nggak race sama smartOpenFolder
    await writer.end();
    writeSpin.succeed(chalk.green(`Saved: ${basename(outPath)}`));

    this.dim("   📂 Opening output directory...");
    UtilFunctions.smartOpenFolder(SYSTEM.OUT_DIR);
  }
}

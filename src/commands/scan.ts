import { existsSync } from "node:fs";
import { basename, join, relative } from "node:path";
import chalk from "chalk";
import Table from "cli-table3";
import { DEFAULT_CONFIG, SYSTEM } from "../constants/defaults.js"; // ← Tambah DEFAULT_CONFIG
import { BaseCommand } from "../core/BaseCommand.js";
import { Scanner } from "../core/Scanner.js";
import { AIManager } from "../managers/AIManager.js"; // ← TAMBAH INI
import { ConfigManager } from "../managers/ConfigManager.js";
import type {
  AIDigestSuggestion,
  AppConfig,
  ScanStats,
  TreeIgnoreMode,
} from "../types/index.js"; // ← Update types
import * as UtilFunctions from "../utils/index.js";
import { generateLog } from "../utils/logger.js";

export class ScanCommand extends BaseCommand {
  public name = "scan";
  public description = "Scan directory and generate digest";
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
          "🤖 AI Copilot (Keyword-based Config)", // ← BARU
        ],
        { columns: 1 },
      );

      // 🔥 AI COPILOT ROUTE
      if (mode.startsWith("🤖 AI Copilot")) {
        await this.runCopilotFlow();
        return;
      }

      if (mode.startsWith("Custom")) {
        // 🔥 PAKAI TREESELECT MULTI-MODE
        const tree = new UtilFunctions.TreeSelect({
          title: "Select paths to scan:",
          rootDir: process.cwd(),
          multiSelect: true,
        });
        const result = await tree.run();

        if (Array.isArray(result) && result.length > 0) {
          // Convert absolute paths dari TreeSelect jadi relative path
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
   * 🤖 AI COPILOT FLOW: Generate config berdasarkan keyword
   */
  private async runCopilotFlow(): Promise<void> {
    this.createBox("🤖 AI COPILOT DIGESTER", "Smart Config");

    const cwd = process.cwd();
    const auth = await ConfigManager.getAuth();

    // 1. Auth Check
    if (!auth.apiKey) {
      this.error("❌ API Key missing. Run 'digest set-key <KEY>' first.");
      process.exit(1);
    }

    // 2. Prompt Ignore Mode
    const ignoreModeSelect = await this.promptSelectV2(
      chalk.cyan("🌳 Tree Ignore Mode:"),
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

    // 3. Generate Clean Tree
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

    // 4. Prompt Keyword
    const keyword = await this.promptText(
      chalk.cyan("🔍 Enter keyword/criteria (e.g. 'manager', 'auth'): "),
      "manager",
    );
    if (!keyword) {
      this.warn("Keyword is required. Aborted.");
      return;
    }

    // 5. AI Request
    const aiSpinner = this.spinner(`Consulting ${auth.model || "Gemini"}...`);
    let suggestion: AIDigestSuggestion;
    try {
      suggestion = await AIManager.suggestDigestConfig(tree, keyword, auth);
      aiSpinner.succeed("AI suggestion ready!");
    } catch (e) {
      aiSpinner.fail(`AI Error: ${(e as Error).message}`);
      return;
    }

    // 6. Display Reasoning
    this.createBox(
      suggestion.reasoning || "No reasoning provided.",
      "AI Reasoning",
    );

    // 7. Validate matchedPaths (filter yang ga ada di tree asli)
    const validPaths = suggestion.matchedPaths.filter(
      (p) => tree.includes(p), // Sekarang validasinya pasti akurat karena keduanya path murni
    );

    if (validPaths.length === 0) {
      this.warn(
        "⚠️ AI did not find or validate any specific paths matching the keyword.",
      );
    } else {
      this.log(chalk.cyan(`\n📂 AI found ${validPaths.length} matched paths.`));
    }

    // ─── 🛠️ EDIT PHASE: Remove & Add Manual ───
    let finalPathsToInclude = new Set<string>(validPaths);
    let editing = true;

    while (editing) {
      const action = await this.promptSelectV2(
        chalk.cyan("🛠️ Edit AI Suggestions:"),
        [
          "➕ Add paths manually (from file tree)",
          "➖ Remove paths from AI suggestions",
          "✅ Confirm & Apply to config",
          "❌ Abort",
        ],
        { columns: 1 },
      );

      if (action === "❌ Abort") {
        this.dim("Aborted. No changes made.");
        return;
      }

      if (action === "✅ Confirm & Apply to config") {
        editing = false;
        break;
      }

      if (action === "➕ Add paths manually") {
        // Filter tree yang BELUM ada di finalPathsToInclude
        const availableToAdd = tree.filter((p) => !finalPathsToInclude.has(p));

        if (availableToAdd.length === 0) {
          this.warn("All available paths are already included.");
          continue;
        }

        // Gunakan AutoComplete path-aware
        const customPath = await this.promptAutoComplete(
          "Type or select path to add:",
          availableToAdd,
          { limit: 15 },
        );

        if (customPath && tree.includes(customPath)) {
          finalPathsToInclude.add(customPath);
          this.success(`   ✅ Added: ${chalk.bold(customPath)}`);
        } else if (customPath) {
          this.warn(`   ⚠️ Path "${customPath}" not found in tree. Ignored.`);
        }
      }

      if (action === "➖ Remove paths from AI suggestions") {
        if (finalPathsToInclude.size === 0) {
          this.warn("No paths to remove.");
          continue;
        }

        // Gunakan MultiSelect untuk uncheck/remove
        const multiSelect = new UtilFunctions.MultiSelect<string>()
          .title("Select paths to REMOVE (Space to toggle, Enter to confirm):")
          .columns(1)
          .pageSize(10);

        Array.from(finalPathsToInclude)
          .sort()
          .forEach((p) => {
            multiSelect.add(p, p, { selected: true }); // Default selected (akan di-keep)
          });

        const keptPaths = await multiSelect.run();
        finalPathsToInclude = new Set(keptPaths);
        this.warn(
          `   🗑️ Removed ${finalPathsToInclude.size - keptPaths.length} path(s).`,
        );
      }
    }

    // ─── 💾 APPLY CONFIG PHASE ───
    if (
      finalPathsToInclude.size === 0 &&
      (!suggestion.suggestedIgnore || suggestion.suggestedIgnore.length === 0)
    ) {
      this.warn(
        "No paths selected and no ignore patterns suggested. Nothing to apply.",
      );
      return;
    }

    const applyMode = await this.promptSelectV2(
      "How to apply?",
      [
        "Merge (Add to existing config)",
        "Replace (Overwrite ignore & include)",
        "Include Only (Just add to forceInclude)",
      ],
      { columns: 1 },
    );

    const cfgPath = join(cwd, "prompter.config.json");

    const existingConfig: AppConfig = {
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSize,
      forceInclude: new Set(DEFAULT_CONFIG.forceInclude),
      prePushScripts: [...(DEFAULT_CONFIG.prePushScripts || [])],
    };

    if (await Bun.file(cfgPath).exists()) {
      try {
        const raw = await Bun.file(cfgPath).json();
        if (raw.ignoredPatterns)
          existingConfig.ignoredPatterns = new Set(raw.ignoredPatterns);
        if (raw.ignoredExts)
          existingConfig.ignoredExts = new Set(raw.ignoredExts);
        if (raw.maxFileSize) existingConfig.maxFileSize = raw.maxFileSize;
        if (raw.forceInclude)
          existingConfig.forceInclude = new Set(raw.forceInclude);
        if (raw.prePushScripts)
          existingConfig.prePushScripts = raw.prePushScripts;
      } catch {}
    }

    let newPatterns = existingConfig.ignoredPatterns;
    let newForce = existingConfig.forceInclude;

    if (applyMode.startsWith("Merge")) {
      (suggestion.suggestedIgnore || []).forEach((p) => newPatterns.add(p));
      finalPathsToInclude.forEach((p) => newForce.add(p));
    } else if (applyMode.startsWith("Replace")) {
      newPatterns = new Set(suggestion.suggestedIgnore || []);
      newForce = new Set(finalPathsToInclude);
    } else if (applyMode.startsWith("Include Only")) {
      finalPathsToInclude.forEach((p) => newForce.add(p));
    }

    const finalConfig: AppConfig = {
      ignoredPatterns: newPatterns,
      ignoredExts: existingConfig.ignoredExts,
      maxFileSize: existingConfig.maxFileSize,
      forceInclude: newForce,
      prePushScripts: existingConfig.prePushScripts || [],
    };

    const serializable = {
      ignoredPatterns: Array.from(finalConfig.ignoredPatterns).sort((a, b) =>
        a.localeCompare(b),
      ),
      ignoredExts: Array.from(finalConfig.ignoredExts).sort((a, b) =>
        a.localeCompare(b),
      ),
      maxFileSize: finalConfig.maxFileSize,
      forceInclude: Array.from(finalConfig.forceInclude).sort((a, b) =>
        a.localeCompare(b),
      ),
      prePushScripts: (finalConfig.prePushScripts || []).sort((a, b) =>
        a.localeCompare(b),
      ),
    };

    try {
      await Bun.write(cfgPath, JSON.stringify(serializable, null, 2));
      this.success(`\n✅ Config updated: ${cfgPath}`);
    } catch (e) {
      this.error(`Failed to save config: ${(e as Error).message}`);
      return;
    }

    // 10. Ask to scan now
    const scanNow = await this.promptYesNo("Scan project with new config now?");
    if (scanNow) {
      await this.scanTargets(["."]);
    } else {
      this.dim("You can run 'digest scan' manually later.");
    }
  }

  // 🔥 NEW HELPER: Detect Project Name from Git or Folder
  private async getProjectName(root: string): Promise<string> {
    try {
      // 1. Coba baca dari .git/config (Paling Akurat)
      const gitConfigPath = join(root, ".git", "config");
      const gitConfigFile = Bun.file(gitConfigPath);

      if (await gitConfigFile.exists()) {
        const text = await gitConfigFile.text();
        // Regex buat ambil nama repo dari URL (e.g. github.com/user/my-repo.git -> my-repo)
        const match = text.match(/url\s*=\s*.*\/([^/]+?)(\.git)?\s*$/m);
        if (match?.[1]) {
          return match[1];
        }
      }
    } catch {
      // Ignore error, fallback ke folder name
    }

    // 2. Fallback: Nama folder tempat command dijalankan
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
      duration: "0",
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

    aggregatedStats.duration = (performance.now() - startTime).toFixed(0);

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
      [chalk.dim("Duration"), `${stats.duration}ms`],
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

  private async writeOutput(stats: ScanStats, projectName: string) {
    // 🔥 Nama file output sekarang konsisten: DIGEST_NamaRepo_Timestamp
    const outPath = join(
      SYSTEM.OUT_DIR,
      `DIGEST_${projectName}_${Date.now()}.md`,
    );

    if (!(await Bun.file(SYSTEM.OUT_DIR).exists())) {
      const fs = await import("node:fs/promises");
      if (!existsSync(SYSTEM.OUT_DIR))
        await fs.mkdir(SYSTEM.OUT_DIR, { recursive: true });
    }

    const writer = Bun.file(outPath).writer({
      highWaterMark: SYSTEM.CHUNK_SIZE,
    });

    // 🔥 Judul Markdown juga ngikutin nama repo
    writer.write(
      `# Project Digest: ${projectName}\n\n## Structure\n\`\`\`\n${stats.tree.join(
        "\n",
      )}\n\`\`\`\n\n## Code Content\n`,
    );

    const writeSpin = this.spinner("Writing to disk...");
    let done = 0;

    for (let i = 0; i < stats.files.length; i += SYSTEM.CONCURRENCY) {
      const chunk = stats.files.slice(i, i + SYSTEM.CONCURRENCY);

      const contents = await Promise.all(
        chunk.map(async (f) => {
          try {
            const text = await Bun.file(f.path).text();
            return `\n// --- ${f.relPath} ---\n\`\`\`${f.ext}\n${text}\n\`\`\`\n`;
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

    writer.end();
    writeSpin.succeed(chalk.green(`Saved: ${basename(outPath)}`));

    this.dim("   📂 Opening output directory...");
    UtilFunctions.smartOpenFolder(SYSTEM.OUT_DIR);
  }
}

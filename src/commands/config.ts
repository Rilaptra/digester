import { readdir } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import chalk from "chalk";
import { DEFAULT_CONFIG } from "../constants/defaults.js";
import { BaseCommand } from "../core/BaseCommand.js";
import type { AppConfig } from "../types/index.js";

export class ConfigCommand extends BaseCommand {
  public name = "config";
  public description = "Generate or interactively edit configuration file";
  public aliases = ["init"];

  public async execute(args: string[]): Promise<void> {
    const cfgPath = join(process.cwd(), "prompter.config.json");

    // Mode: generate default saja
    if (args.includes("--default") || args.includes("-d")) {
      await this.writeConfig(cfgPath, DEFAULT_CONFIG);
      this.success(`Config generated at: ${cfgPath}`);
      return;
    }

    // Mode: interaktif
    const existing = await this.loadConfig(cfgPath);

    this.createBox("⚙️  CONFIG EDITOR", "Interactive");

    // ─── 1. ignoredPatterns ───
    existing.ignoredPatterns = await this.editIgnoredPatterns(existing);

    // ─── 2. ignoredExts ───
    existing.ignoredExts = await this.editIgnoredExts(existing);

    // ─── 3. maxFileSize ───
    const newSize = await this.promptText(
      chalk.cyan("Max file size (KB):"),
      String(existing.maxFileSize),
    );
    existing.maxFileSize = Number(newSize) || 500;

    // ─── 4. forceInclude ← BARU ───
    existing.forceInclude = await this.editForceInclude(existing);

    // ─── 5. prePushScripts ───
    const editScripts = await this.promptYesNo("Edit prePushScripts?", false);
    if (editScripts) {
      existing.prePushScripts = await this.editPrePushScripts();
    }

    // ─── Write ───
    await this.writeConfig(cfgPath, existing);
    this.success(`\n✅ Config saved: ${cfgPath}`);
  }

  // ─── HELPERS ───

  private async loadConfig(cfgPath: string): Promise<AppConfig> {
    const getDefault = (): AppConfig => ({
      ignoredPatterns: new Set(DEFAULT_CONFIG.ignoredPatterns),
      ignoredExts: new Set(DEFAULT_CONFIG.ignoredExts),
      maxFileSize: DEFAULT_CONFIG.maxFileSize,
      forceInclude: new Set(DEFAULT_CONFIG.forceInclude),
      prePushScripts: [...(DEFAULT_CONFIG.prePushScripts || [])],
    });

    if (!(await Bun.file(cfgPath).exists())) {
      return getDefault();
    }

    try {
      const raw = await Bun.file(cfgPath).json();
      const config = getDefault();

      // 🔥 OVERRIDE: Di Editor, kita baca apa adanya dari JSON.
      // Kalau user nge-set [] (array kosong), defaultnya bakal kehapus total.
      if (raw.ignoredPatterns)
        config.ignoredPatterns = new Set(raw.ignoredPatterns);
      if (raw.ignoredExts) config.ignoredExts = new Set(raw.ignoredExts);
      if (raw.maxFileSize) config.maxFileSize = raw.maxFileSize;
      if (raw.forceInclude) config.forceInclude = new Set(raw.forceInclude);
      if (raw.prePushScripts) config.prePushScripts = raw.prePushScripts;

      return config;
    } catch {
      return getDefault();
    }
  }

  private async writeConfig(cfgPath: string, config: AppConfig): Promise<void> {
    const serializable = {
      // 🔥 Sort abjad sebelum write
      ignoredPatterns: Array.from(config.ignoredPatterns).sort((a, b) =>
        a.localeCompare(b),
      ),
      ignoredExts: Array.from(config.ignoredExts).sort((a, b) =>
        a.localeCompare(b),
      ),
      maxFileSize: config.maxFileSize,
      forceInclude: Array.from(config.forceInclude).sort((a, b) =>
        a.localeCompare(b),
      ),
      prePushScripts: (config.prePushScripts || []).sort((a, b) =>
        a.localeCompare(b),
      ),
    };
    await Bun.write(cfgPath, JSON.stringify(serializable, null, 2));
  }

  private async scanAllPaths(rootDir: string, maxDepth = 4): Promise<string[]> {
    const paths: string[] = [];

    const walk = async (dir: string, depth: number) => {
      if (depth > maxDepth) return;

      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      // Sort entries di level ini dulu biar children juga urut
      entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of entries) {
        // Skip hidden & junk
        if (entry.name.startsWith(".") || entry.name === "node_modules")
          continue;

        const fullPath = join(dir, entry.name);
        const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");

        // Tambahkan path ini
        paths.push(relPath);

        // Kalau directory, recurse
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      }
    };

    await walk(rootDir, 0);

    // Final sort abjad (safety, should already be sorted)
    return paths.sort((a, b) => a.localeCompare(b));
  }

  private async scanExtensions(rootDir: string): Promise<string[]> {
    const exts = new Set<string>();

    const walk = async (dir: string, depth: number) => {
      if (depth > 3) return;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith(".") || entry.name === "node_modules")
            continue;
          if (entry.isFile()) {
            const ext = extname(entry.name);
            if (ext) exts.add(ext);
          } else if (entry.isDirectory()) {
            await walk(join(dir, entry.name), depth + 1);
          }
        }
      } catch {}
    };

    await walk(rootDir, 0);
    return Array.from(exts).sort();
  }

  private async findIgnoredItems(
    rootDir: string,
    config: AppConfig,
  ): Promise<string[]> {
    const ignored: string[] = [];

    const walk = async (dir: string, depth: number) => {
      if (depth > 4) return;
      try {
        const entries = await readdir(dir, { withFileTypes: true });
        // Sort abjad per level
        entries.sort((a, b) => a.name.localeCompare(b.name));

        for (const entry of entries) {
          if (entry.name.startsWith(".") && entry.name !== ".env") continue;
          if (entry.name === "node_modules") continue;

          const fullPath = join(dir, entry.name);
          const relPath = relative(rootDir, fullPath).replace(/\\/g, "/");

          if (entry.isDirectory()) {
            if (config.ignoredPatterns.has(entry.name)) {
              ignored.push(`${relPath}/`);
            }
            // Selalu recurse biar dapet children juga
            await walk(fullPath, depth + 1);
          } else {
            const ext = extname(entry.name);
            if (
              config.ignoredPatterns.has(entry.name) ||
              config.ignoredExts.has(ext)
            ) {
              ignored.push(relPath);
            }
          }
        }
      } catch {}
    };

    await walk(rootDir, 0);
    return ignored.sort((a, b) => a.localeCompare(b));
  }

  // ─── INTERACTIVE EDITORS ───

  private async editIgnoredPatterns(config: AppConfig): Promise<Set<string>> {
    const current = new Set(config.ignoredPatterns);
    const allPaths = await this.scanAllPaths(process.cwd());

    this.log(chalk.bold("\n📁 ignoredPatterns:"));
    this.dim("   Ketik untuk filter, ↑↓ navigate, Enter select\n");

    let editing = true;
    while (editing) {
      if (current.size > 0) {
        this.log(
          chalk.gray("   Current: ") +
            Array.from(current)
              .sort((a, b) => a.localeCompare(b))
              .map((p) => chalk.yellow(p))
              .join(", "),
        );
      }

      const action = await this.promptSelectV2(
        "Action:",
        ["➕ Add pattern", "➖ Remove pattern", "✅ Done"],
        { columns: 3 },
      );

      if (action === "✅ Done") {
        editing = false;
      } else if (action === "➕ Add pattern") {
        // 🔥 FILTER: hanya yang BELUM ada di current
        const available = allPaths.filter((p) => !current.has(p));

        if (available.length === 0) {
          this.warn("All paths already in ignored patterns.");
          continue;
        }

        const newPattern = await this.promptAutoComplete(
          "Pattern (folder/file path):",
          available, // ← filtered
        );

        const trimmed = newPattern.trim();
        if (trimmed.length === 0) {
          this.warn("Empty pattern ignored.");
          continue;
        }
        if (current.has(trimmed)) {
          this.warn(`"${trimmed}" already in list.`);
          continue;
        }

        current.add(trimmed);
        this.success(`   ✅ Added: ${chalk.bold(trimmed)}`);
      } else if (action === "➖ Remove pattern") {
        if (current.size === 0) {
          this.warn("Nothing to remove.");
          continue;
        }

        // 🔥 Sudah benar: hanya yang SUDAH ada di current
        const toRemove = await this.promptSelectV2(
          "Remove which?",
          Array.from(current).sort((a, b) => a.localeCompare(b)),
        );
        current.delete(toRemove);
        this.success(`   🗑️ Removed: ${toRemove}`);
      }
    }

    return current;
  }

  private async editIgnoredExts(config: AppConfig): Promise<Set<string>> {
    const current = new Set(config.ignoredExts);

    this.log(chalk.bold("\n📄 ignoredExts:"));

    const editExts = await this.promptYesNo("Edit ignored extensions?", false);
    if (!editExts) return current;

    const allExts = await this.scanExtensions(process.cwd());

    let editing = true;
    while (editing) {
      if (current.size > 0) {
        this.log(
          chalk.gray("   Current: ") +
            Array.from(current)
              .sort((a, b) => a.localeCompare(b))
              .map((e) => chalk.yellow(e))
              .join(", "),
        );
      }

      const action = await this.promptSelectV2(
        "Extensions action:",
        ["➕ Add", "➖ Remove", "✅ Done"],
        { columns: 3 },
      );

      if (action === "✅ Done") {
        editing = false;
      } else if (action === "➕ Add") {
        // 🔥 FILTER: hanya ext yang BELUM ada di current
        const available = allExts.filter((e) => !current.has(e));

        if (available.length === 0) {
          this.warn("All extensions already in ignored list.");
          continue;
        }

        const newExt = await this.promptAutoComplete(
          "Extension:",
          available, // ← filtered
        );

        const trimmed = newExt.trim();
        if (trimmed.length === 0) {
          this.warn("Empty extension ignored.");
          continue;
        }
        if (current.has(trimmed)) {
          this.warn(`"${trimmed}" already in list.`);
          continue;
        }

        current.add(trimmed);
        this.success(`   ✅ Added: ${chalk.bold(trimmed)}`);
      } else if (action === "➖ Remove") {
        if (current.size === 0) {
          this.warn("Nothing to remove.");
          continue;
        }

        // 🔥 Hanya yang SUDAH ada
        const rm = await this.promptSelectV2(
          "Remove which?",
          Array.from(current).sort((a, b) => a.localeCompare(b)),
        );
        current.delete(rm);
        this.success(`   🗑️ Removed: ${rm}`);
      }
    }

    return current;
  }

  private async editForceInclude(config: AppConfig): Promise<Set<string>> {
    const current = new Set(config.forceInclude);

    this.log(chalk.bold("\n🔓 forceInclude:"));
    this.dim("   Items that are ignored but still included in digest\n");

    const edit = await this.promptYesNo("Edit forceInclude?", false);
    if (!edit) return current;

    // 🔥 Dapatkan items yang sedang di-ignore (candidates untuk force-include)
    const ignoredItems = await this.findIgnoredItems(process.cwd(), config);

    let editing = true;
    while (editing) {
      if (current.size > 0) {
        this.log(
          chalk.gray("   Current: ") +
            Array.from(current)
              .sort((a, b) => a.localeCompare(b))
              .map((p) => chalk.green(p))
              .join(", "),
        );
      }

      const action = await this.promptSelectV2(
        "forceInclude action:",
        [
          "➕ Add (from ignored items)",
          "➕ Add (custom path)",
          "➖ Remove",
          "✅ Done",
        ],
        { columns: 1 },
      );

      if (action === "✅ Done") {
        editing = false;
      } else if (action.startsWith("➕ Add (from ignored")) {
        // 🔥 FILTER: hanya yang BELUM ada di current
        const available = ignoredItems.filter((i) => !current.has(i));

        if (available.length === 0) {
          this.warn("No more ignored items to force-include.");
          continue;
        }

        const selected = await this.promptMultiSelect(
          chalk.cyan("Select items to force-include:"),
          available, // ← filtered
        );

        for (const item of selected) {
          current.add(item);
          this.success(`   ✅ Force-include: ${chalk.bold(item)}`);
        }
      } else if (action.startsWith("➕ Add (custom")) {
        // Custom path — gabungkan ignored items + all paths sebagai suggestions
        const allPaths = await this.scanAllPaths(process.cwd());
        const available = allPaths.filter((p) => !current.has(p));

        const customPath = await this.promptAutoComplete(
          "Custom path:",
          available, // ← filtered
        );

        const trimmed = customPath.trim();
        if (trimmed.length === 0) {
          this.warn("Empty path ignored.");
          continue;
        }
        if (current.has(trimmed)) {
          this.warn(`"${trimmed}" already in list.`);
          continue;
        }

        current.add(trimmed);
        this.success(`   ✅ Force-include: ${chalk.bold(trimmed)}`);
      } else if (action === "➖ Remove") {
        if (current.size === 0) {
          this.warn("Nothing to remove.");
          continue;
        }

        // 🔥 Hanya yang SUDAH ada
        const rm = await this.promptSelectV2(
          "Remove which?",
          Array.from(current).sort((a, b) => a.localeCompare(b)),
        );
        current.delete(rm);
        this.success(`   🗑️ Removed: ${rm}`);
      }
    }

    return current;
  }

  private async editPrePushScripts(): Promise<string[]> {
    const scripts: string[] = [];

    // Get available scripts from package.json
    try {
      const pkg = await Bun.file(join(process.cwd(), "package.json")).json();
      const availableScripts = Object.keys(pkg.scripts || {});

      if (availableScripts.length > 0) {
        const selected = await this.promptMultiSelect(
          chalk.cyan("Select npm scripts to run before push:"),
          availableScripts.map((s) => `[script] ${s}`),
        );
        scripts.push(...selected);
      }
    } catch {}

    return scripts;
  }
}

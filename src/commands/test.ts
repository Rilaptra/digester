// --- src/commands/test.ts ---

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import {
  AutoComplete,
  Confirm,
  MultiSelect,
  TextPrompt,
  TreeSelect,
} from "../utils/index.js";
import { Editor } from "../utils/tui/Editor.js";
import { Select } from "../utils/tui/Select.js";
import { SpinNumber } from "../utils/tui/SpinNumber.js";

export class TestCommand extends BaseCommand {
  public name = "test";
  public description = "Stress test for TUI Pagination & Grid system";
  public aliases = ["demo", "tui"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🧪 TUI ULTIMATE STRESS TEST");

    // --- TEST 1: VERTICAL PAGINATION (Heavy List) ---
    this.log(
      chalk.yellow("\n📜 TEST 1: Vertical Pagination (100 items, 7 visible)"),
    );
    this.dim("   Try scrolling down fast. Watch the scrollbar on the right.");

    // Generate 100 dummy files
    const fileSelect = new Select<string>()
      .title("Select a file to delete (Fake)")
      .pageSize(7); // 🔥 STRICT LIMIT 7 BARIS

    for (let i = 1; i <= 100; i++) {
      const isDangerous = i % 10 === 0; // Tiap kelipatan 10 bahaya
      fileSelect.add(
        `File_System_Log_${i.toString().padStart(3, "0")}.log`,
        `log_${i}`,
        {
          icon: isDangerous ? "🔥" : "📄",
          color: isDangerous ? chalk.red : undefined,
          desc: isDangerous
            ? "High Risk"
            : `${(Math.random() * 100).toFixed(1)} KB`,
        },
      );
    }

    const selectedFile = await fileSelect.run();
    this.success(`Selected: ${selectedFile}`);

    // --- TEST 2: GRID PAGINATION (The Matrix) ---
    this.log(
      chalk.yellow(
        "\n▦ TEST 2: Grid Pagination (60 items, 4 Columns, 5 Rows visible)",
      ),
    );
    this.dim("   Navigate using arrow keys. It should scroll smoothly.");

    const gridSelect = new Select<string>()
      .title("Select Component Version")
      .columns(4) // 4 Kolom
      .pageSize(5); // 5 Baris (Total 20 item visible at once)

    for (let i = 1; i <= 60; i++) {
      // Bikin variasi warna biar visualnya enak buat debugging
      const colors = [chalk.cyan, chalk.blue, chalk.magenta, chalk.green];
      const color = colors[i % 4];

      gridSelect.add(`v${i}.0`, `v${i}`, {
        icon: "📦",
        color: color,
      });
    }

    const selectedVer = await gridSelect.run();
    this.success(`Selected Version: ${selectedVer}`);

    // --- TEST 3: MULTI-SELECT GRID (New Feature) ---
    this.log(
      chalk.yellow("\n☑ TEST 3: Multi-Select + Grid (Select Ingredients)"),
    );
    this.dim("   Use <Space> to toggle, Arrows to move, <Enter> to submit.");

    const pizzaToppings = new MultiSelect<string>()
      .title("Build your Pizza (Min 2 toppings):")
      .columns(3) // Grid Mode
      .pageSize(5) // Pagination
      .minSelect(2); // Validation

    const toppings = [
      "Cheese",
      "Pepperoni",
      "Mushrooms",
      "Onions",
      "Sausage",
      "Bacon",
      "Extra cheese",
      "Black olives",
      "Green peppers",
      "Pineapple",
      "Spinach",
      "Chicken",
      "Red peppers",
      "Pesto",
      "Garlic",
      "Tomato",
      "Basil",
      "Ham",
      "Beef",
      "Salami",
    ];

    toppings.forEach((t) => {
      // Disable Pineapple karena haram di pizza wkwk
      const isPineapple = t === "Pineapple";
      pizzaToppings.add(t, t, { disabled: isPineapple });
    });

    const selectedToppings = await pizzaToppings.run();
    this.success(`Making pizza with: ${selectedToppings.join(", ")}`);

    // --- TEST 4: CONFIRM CLASS ---
    this.log(chalk.yellow("\n🌗 TEST 4: Confirm Class (Boolean)"));

    const isReady = await new Confirm({
      title: "Are you ready to rock?",
      initialValue: true,
    }).run();

    if (!isReady) {
      this.error("Sad noise... exiting demo.");
      return;
    }

    // --- TEST 5: TEXT PROMPT CLASS ---
    this.log(chalk.yellow("\n✎ TEST 5: Text Prompt (Validation & Password)"));

    const username = await new TextPrompt({
      title: "Enter Username",
      placeholder: "e.g. Rilaptra",
      validate: (val) => (val.length < 3 ? "Username must be > 3 chars" : true),
    }).run();

    const password = await new TextPrompt({
      title: "Enter Secret Password",
      password: true,
      validate: (val) => (val === "123456" ? "Too weak!" : true),
    }).run();

    this.success(`User created: ${username} (Pass length: ${password.length})`);

    // --- TEST 6: RECURSIVE PATH NAVIGATOR (CD COMMAND) ---
    this.log(chalk.yellow("\n📂 TEST 6: Recursive File System Navigation"));
    this.dim(
      "   Try typing 'src/' then TAB. Then 'comm' TAB. It reads REAL folders!",
    );

    const cwd = process.cwd();

    const pathCmd = await new AutoComplete({
      title: "cd",
      initialValue: "",
      separator: " ", // Token dipisah spasi (misal: "cd src/utils")
      suggest: async (token) => {
        // Token: bagian text yg sedang diketik (misal: "src/co")

        // 1. Determine Base Directory & Search Term
        // Kalau token kosong, list isi CWD
        // Kalau token "src/", list isi CWD/src
        // Kalau token "src/ut", list isi CWD/src yang depannya "ut"

        let searchDir = cwd;
        let filePrefix = "";

        // Detect if user typed a path separator
        const lastSepIndex = token.lastIndexOf("/"); // Gunakan / agar konsisten di UI (atau path.sep)

        if (lastSepIndex !== -1) {
          // "src/utils/" -> Dir: "src/utils", Prefix: ""
          // "src/u"      -> Dir: "src", Prefix: "u"
          const dirPart = token.slice(0, lastSepIndex);
          searchDir = join(cwd, dirPart);
          filePrefix = token.slice(lastSepIndex + 1);
        } else {
          filePrefix = token;
        }

        try {
          const entries = await readdir(searchDir, { withFileTypes: true });

          // Filter: Hanya Folder (karena ini command 'cd')
          // Dan match dengan prefix yg udah diketik
          const matches = entries
            .filter((e) => e.isDirectory() && e.name.startsWith(filePrefix))
            .map((e) => {
              // Reconstruct full relative token
              // Misal user ketik "sr", match "src", return "src/"
              // Misal user ketik "src/ut", match "utils", return "src/utils/"

              const relativePart =
                lastSepIndex !== -1
                  ? token.slice(0, lastSepIndex + 1) + e.name
                  : e.name;

              return `${relativePart}/`; // Tambah slash biar user bisa langsung lanjut ngetik dalam folder tsb
            });

          return matches;
        } catch {
          return []; // Invalid path, no suggestion
        }
      },
    }).run();

    this.success(`Navigated to: ${pathCmd}`);

    // --- DEMO 2: NESTED CONFIG (SET COMMAND) ---
    this.log(chalk.yellow("\n⚙️  DEMO 2: Context-Aware Config Setter"));
    this.dim("   Try typing 'set api key' or 'set theme color'.");
    this.dim("   Suggestions change based on previous words!");

    // Mock Data Config Structure
    const configSchema: Record<string, Record<string, string>> = {
      api: {
        url: "https://api.example.com",
        key: "secret",
        port: "8080",
        timeout: "5000",
      },
      theme: {
        color: "dark",
        font: "Fira Code",
        icons: "true",
      },
      core: {
        logging: "verbose",
        threads: "4",
      },
    };

    const configCmd = await new AutoComplete({
      title: "config",
      initialValue: "set ",
      separator: " ",
      suggest: (token, fullInput) => {
        // 🔥 FIX: Deteksi Context dengan Benar
        const trimmedInput = fullInput.trim();
        const parts = trimmedInput.split(/\s+/);
        const isTrailingSpace = fullInput.endsWith(" ");

        // Tentukan index argumen mana yang lagi diedit.
        // "set"      -> parts=["set"], trailing=false, index=0
        // "set "     -> parts=["set"], trailing=true,  index=1 (Config Category)
        // "set api"  -> parts=["set", "api"], trailing=false, index=1 (Config Category)
        // "set api " -> parts=["set", "api"], trailing=true,  index=2 (Config Key)

        const currentIndex = isTrailingSpace ? parts.length : parts.length - 1;

        // Level 1: "set <category>" (Index 1)
        // Kita suggest category
        if (currentIndex === 1) {
          return Object.keys(configSchema).filter((k) => k.startsWith(token));
        }

        // Level 2: "set category <key>" (Index 2)
        // Kita butuh category dari parts[1]
        if (currentIndex === 2) {
          const category = parts[1]; // "api" atau "theme"
          if (configSchema[category]) {
            return Object.keys(configSchema[category]).filter((k) =>
              k.startsWith(token),
            );
          }
        }

        // Level 3: "set category key <value>" (Index 3)
        // Kita suggest value saat ini
        if (currentIndex === 3) {
          const category = parts[1];
          const key = parts[2];
          if (configSchema[category]?.[key]) {
            return [`"${configSchema[category][key]}"`];
          }
        }

        return [];
      },
    }).run();

    this.success(`Executed: ${configCmd}`);

    // --- TEST 8: SPIN NUMBER ---
    this.log(chalk.yellow("\n🔢 TEST 8: Numeric Input (Arrow Keys)"));
    const port = await new SpinNumber({
      title: "Select Port Number",
      min: 3000,
      max: 9000,
      initial: 3000,
      step: 1, // Shift+Arrow = +10
    }).run();
    this.success(`Server starting on port ${port}`);

    const memory = await new SpinNumber({
      title: "Max Memory Limit",
      min: 128,
      max: 4096,
      initial: 512,
      step: 128,
      unit: "MB",
    }).run();
    this.success(`Memory set to ${memory}MB`);

    // --- TEST 9: MULTILINE EDITOR ---
    this.log(chalk.yellow("\n📝 TEST 9: Multiline Editor (Mini Vim)"));
    this.dim("   Type freely. Enter for newline. Ctrl+S to save.");

    const bio = await new Editor({
      title: "Write your commit message description:",
      placeholder: "Explain why you made these changes...",
    }).run();

    this.createBox(bio, "COMMIT MESSAGE BODY");

    // --- TEST 10: TREE SELECT (Vim Style File Explorer) ---
    this.log(chalk.yellow("\n🌲 TEST 10: Tree Select (File Explorer)"));
    this.dim("   Use Arrows or Vim Keys (HJKL) to navigate. Enter to select.");

    const tree = new TreeSelect({
      title: "Explore Project Source Code:",
      rootDir: process.cwd(), // Mulai dari root project
      maxDepth: 5, // Safety limit
    });

    const selectedPath = await tree.run();

    if (selectedPath) {
      this.success(`Selected Path: ${selectedPath}`);
    } else {
      this.warn("Selection cancelled (Esc pressed).");
    }

    // --- 👆 END OF NEW TEST ---

    this.createBox("🎉 DEMO COMPLETED SUCCESSFULLY");
  }
}

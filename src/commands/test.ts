// --- src/commands/test.ts ---
import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { Select } from "../utils/tui/Select.js";
import { MultiSelect } from "../utils/index.js";

export class TestCommand extends BaseCommand {
  public name = "test";
  public description = "Stress test for TUI Pagination & Grid system";
  public aliases = ["demo", "tui"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🧪 TUI STRESS TEST");

    // --- TEST 1: VERTICAL PAGINATION (Heavy List) ---
    this.log(
      chalk.yellow("\n📜 TEST 1: Vertical Pagination (100 items, 7 visible)")
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
        }
      );
    }

    const selectedFile = await fileSelect.run();
    this.success(`Selected: ${selectedFile}`);

    // --- TEST 2: GRID PAGINATION (The Matrix) ---
    this.log(
      chalk.yellow(
        "\n▦ TEST 2: Grid Pagination (60 items, 4 Columns, 5 Rows visible)"
      )
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
      chalk.yellow("\n☑ TEST 3: Multi-Select + Grid (Select Ingredients)")
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

    this.createBox("✅ ALL TESTS COMPLETED");
  }
}

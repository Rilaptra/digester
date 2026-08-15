// test.ts
// Jalankan dengan: bun test.ts

import { AutoComplete } from "./src/utils/tui/AutoComplete";
import { CommandPalette } from "./src/utils/tui/CommandPalette";
import { Confirm } from "./src/utils/tui/Confirm";
import { c, write } from "./src/utils/tui/core";
import { Editor } from "./src/utils/tui/Editor";
import { MultiSelect } from "./src/utils/tui/MultiSelect";
import { ToastBuilder } from "./src/utils/tui/Notification";
import { ProgressBar } from "./src/utils/tui/ProgressBar";
import { Select } from "./src/utils/tui/Select";
import { SpinNumber } from "./src/utils/tui/SpinNumber";
import { TextPrompt } from "./src/utils/tui/TextPrompt";
import { TreeSelect } from "./src/utils/tui/TreeSelect";

async function main() {
  console.clear();
  write(`${c.bold(c.cyan("🚀 BunTUI Test Suite"))}\n`);
  write(
    `${c.dim("Menguji semua komponen UI. Tekan Ctrl+C untuk keluar kapan saja.")}\n\n`,
  );
  await Bun.sleep(1000);

  // 1. Confirm
  write(`${c.bold("\n[1/11] Testing Confirm...")}\n`);
  const isReady = await new Confirm({
    title: "Siap memulai test suite?",
    initialValue: true,
  }).run();
  if (!isReady) {
    write(`${c.red("Test dibatalkan.")}\n`);
    process.exit(0);
  }
  await Bun.sleep(500);

  // 2. TextPrompt
  write(`${c.bold("\n[2/11] Testing TextPrompt...")}\n`);
  const name = await new TextPrompt({
    title: "Siapa namamu?",
    placeholder: "Masukkan nama...",
  }).run();
  await Bun.sleep(500);

  // 3. Select
  write(`${c.bold("\n[3/11] Testing Select...")}\n`);
  const color = await new Select<string>()
    .title("Pilih warna favoritmu")
    .add("Merah", "#ff0000", { desc: "Berani dan panas" })
    .add("Hijau", "#00ff00", { desc: "Segar dan alami" })
    .add("Biru", "#0000ff", { desc: "Tenang dan dalam" })
    .run();
  await Bun.sleep(500);

  // 4. MultiSelect
  write(`${c.bold("\n[4/11] Testing MultiSelect...")}\n`);
  const features = await new MultiSelect<string>()
    .title("Pilih fitur favoritmu (min 1)")
    .minSelect(1)
    .add("Kecepatan", "speed", { desc: "Ngebut maksimal" })
    .add("Ringan", "lightweight", { desc: "Hemat RAM" })
    .add("Mudah", "easy", { desc: "UX ramah" })
    .run();
  await Bun.sleep(500);

  // 5. SpinNumber
  write(`${c.bold("\n[5/11] Testing SpinNumber...")}\n`);
  const age = await new SpinNumber({
    title: "Berapa umurmu?",
    min: 1,
    max: 100,
    initial: 20,
    unit: "tahun",
  }).run();
  await Bun.sleep(500);

  // 6. AutoComplete
  write(`${c.bold("\n[6/11] Testing AutoComplete...")}\n`);
  const cmd = await new AutoComplete({
    title: "Ketik command (coba ketik 'git')",
    suggest: (token) => {
      const cmds = [
        "git commit",
        "git push",
        "npm install",
        "bun run",
        "docker build",
      ];
      if (!token) return cmds;
      return cmds.filter((c) =>
        c.toLowerCase().startsWith(token.toLowerCase()),
      );
    },
  }).run();
  await Bun.sleep(500);

  // 7. CommandPalette
  write(`${c.bold("\n[7/11] Testing CommandPalette...")}\n`);
  const action = await new CommandPalette("Pilih aksi cepat", [
    {
      label: "Run Test",
      value: "test",
      description: "Menjalankan unit test",
      icon: "🧪",
    },
    {
      label: "Build Project",
      value: "build",
      description: "Compile proyek",
      icon: "🏗️",
    },
    {
      label: "Deploy to Vercel",
      value: "deploy",
      description: "Push ke produksi",
      icon: "🚀",
    },
  ]).run();
  await Bun.sleep(500);

  // 8. TreeSelect
  write(`${c.bold("\n[8/11] Testing TreeSelect...")}\n`);
  const filePath = await new TreeSelect({
    title: "Pilih sebuah file dari direktori saat ini",
    rootDir: process.cwd(),
    multiSelect: false,
  }).run();
  await Bun.sleep(500);

  // 9. Editor
  write(`${c.bold("\n[9/11] Testing Editor...")}\n`);
  const note = await new Editor({
    title: "Tulis catatan singkat (Ctrl+S to save)",
    placeholder: "Tulis sesuatu di sini...",
  }).run();
  await Bun.sleep(500);

  // 10. ProgressBar
  write(`${c.bold("\n[10/11] Testing ProgressBar...")}\n`);
  const bar = new ProgressBar({
    total: 50,
    title: "Memproses data",
    style: "solid",
    barColor: "gradient",
  });
  bar.start();
  for (let i = 0; i <= 50; i++) {
    bar.update(i);
    await Bun.sleep(50); // Simulasi proses async
  }
  bar.stop("Pemrosesan selesai!", true);
  await Bun.sleep(1000);

  // 11. Notification
  write(`${c.bold("\n[11/11] Testing Notification...")}\n`);
  // Menggunakan ToastBuilder untuk notifikasi OS Native
  await new ToastBuilder("Semua test telah selesai dijalankan dengan sukses!")
    .setTitle("🎉 BunTUI Test Complete")
    .setSound("Default")
    .show();

  // === KESIMPULAN ===
  console.log("\n\n--- 📊 Hasil Test Suite ---");
  console.log(`1. Confirm      : ${isReady ? c.green("Yes") : c.red("No")}`);
  console.log(`2. TextPrompt   : ${c.cyan(name)}`);
  console.log(`3. Select       : ${c.cyan(color)}`);
  console.log(`4. MultiSelect  : ${c.cyan(features.join(", "))}`);
  console.log(`5. SpinNumber   : ${c.cyan(age.toString())}`);
  console.log(`6. AutoComplete : ${c.cyan(cmd)}`);
  console.log(`7. CmdPalette   : ${c.cyan(action || "Dibatalkan")}`);
  console.log(
    `8. TreeSelect   : ${c.cyan((Array.isArray(filePath) ? filePath[0] : filePath) || "Tidak dipilih")}`,
  );
  console.log(
    `9. Editor       : ${c.dim(`(${Bun.stringWidth(note)} chars ditulis)`)}`,
  );
  console.log(`10. ProgressBar : ${c.green("Selesai")}`);
  console.log(`11. Notification: ${c.green("Terkirim ke OS")}`);

  write(`\n${c.bold(c.green("✅ Semua komponen berhasil diuji!"))}\n`);
  process.exit(0);
}

main();

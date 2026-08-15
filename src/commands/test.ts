// --- src/commands/test.ts ---

import chalk from "chalk";
import { BaseCommand } from "../core/BaseCommand.js";
import { ToastBuilder } from "../utils/index.js";

export class TestCommand extends BaseCommand {
  public name = "test";
  public description = "Stress test for Advanced OS Native Notifications";
  public aliases = ["demo", "tui"];

  public async execute(_args: string[]): Promise<void> {
    this.createBox("🧪 ADVANCED NOTIFICATION STRESS TEST");

    // --- TEST 1: UPDATABLE PROGRESS BAR ---
    this.log(chalk.yellow("\n📊 TEST 1: Real-time Updating Progress Bar"));
    this.dim(
      "   Progress bar akan di-update tiap 1 detik (Update seamless tanpa pop-up berulang).",
    );

    const downloadToast = ToastBuilder.create("Mengunduh asset server...")
      .setTitle("Download Manager")
      .setAppName("Digester CLI")
      .setTag("download_001")
      .setProgress("Starting...", 0.0, "Server Assets v2.0")
      .setSound("IM");

    await downloadToast.show();
    this.dim("   -> Notifikasi awal muncul...");

    for (let i = 10; i <= 100; i += 10) {
      await this.delay(1000); // ⏳ Jadi 1000ms (1 detik) biar halus

      let statusText = "Downloading...";
      if (i === 100) statusText = "Download Complete!";

      downloadToast.updateProgress(i / 100, statusText);
      await downloadToast.show();

      process.stdout.write(`\r   Progress: ${i}%`);
    }

    console.log();
    this.success("Progress update selesai!");

    await this.delay(2000);

    // --- TEST 2: ADVANCED BUTTON ACTIONS ---
    this.log(chalk.yellow("\n🕹️ TEST 2: Custom Button Actions"));
    this.dim("   Tombol bisa buka file lokal, folder, atau URL.");

    await ToastBuilder.create("Build selesai dengan 2 warning.")
      .setTitle("Compiler Notification")
      .setAppName("Digester Build Tool")
      .setTag("build_done_001")
      .setSound("Reminder")
      .addButton(
        "Lihat Log File",
        "file:///C:/SHEVA/Project/digester/logs/build.log",
      )
      .addButton("Buka Folder", "file:///C:/SHEVA/Project/digester/logs/")
      .show();

    this.success("Notification with custom actions sent!");

    this.createBox("🎉 DEMO COMPLETED SUCCESSFULLY");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

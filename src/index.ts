#!/usr/bin/env bun
import { AppController } from "./core/AppController.js";

// --- 🎮 MAIN EXECUTION ---
(async () => {
  const app = new AppController();
  await app.run();
})();

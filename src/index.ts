#!/usr/bin/env bun
import { AppController } from "./core/AppController.js";
//new version 17.7.5-ai
// --- 🎮 MAIN EXECUTION ---
(async () => {
  const app = new AppController();
  await app.run();
})();

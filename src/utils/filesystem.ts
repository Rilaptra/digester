// --- src/utils/filesystem.ts ---
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute, normalize, resolve } from "node:path";
import { generateLog } from "./logger.js";

/**
 * Opens a file or directory using the default system application.
 * Cross-platform support (Windows/macOS/Linux).
 *
 * @param {string} path - The path to the file or directory to open.
 * @returns {void}
 *
 * @example
 * openFile("./generated"); // Opens File Explorer/Finder
 */
export function openFile(path: string): void {
  const cmd = process.platform === "win32" ? "explorer" : "open";
  // Linux fallback usually needs 'xdg-open', adding simplistic support here
  const finalCmd = process.platform === "linux" ? "xdg-open" : cmd;

  spawn(finalCmd, [path], { stdio: "ignore", detached: true }).unref();
}

/**
 * Resolves a path string to an absolute path, ensuring it exists.
 * Checks CWD first, then the parent directory.
 *
 * @param {string} input - The relative or absolute path input.
 * @returns {string | null} The absolute path if found, or null if invalid.
 *
 * @example
 * resolvePath("src"); // Returns "/User/Project/src"
 * resolvePath("non-existent"); // Returns null
 */
export function resolvePath(input: string): string | null {
  // 1. Check if absolute
  if (isAbsolute(input)) return existsSync(input) ? input : null;

  // 2. Check relative to CWD
  let p = resolve(process.cwd(), input);
  if (existsSync(p)) return p;

  // 3. Check level up (useful if inside a subdir)
  p = resolve(process.cwd(), "..", input);
  if (existsSync(p)) return p;

  return null;
}

/**
 * Smartly opens a folder.
 * - Windows: Checks if folder is already open. If yes, brings to front. If no, opens it.
 * - Others: Standard open.
 */
export async function smartOpenFolder(path: string): Promise<void> {
  const absPath = resolve(path);

  if (!existsSync(absPath)) {
    generateLog({ type: "warn" }, `Cannot open path (not found): ${absPath}`);
    return;
  }

  // 🪟 WINDOWS SPECIAL TREATMENT (PowerShell Magic)
  if (process.platform === "win32") {
    // Normalize path separators to backslash for Windows comparison
    const targetPath = normalize(absPath);

    // PowerShell Script:
    // 1. Create Shell & WScript Shell objects
    // 2. Loop through open windows
    // 3. Check if LocationURL (decoded) matches our target
    // 4. If found -> AppActivate (Focus)
    // 5. If not found -> Invoke-Item (Open new)
    const psCommand = `
      $target = '${targetPath}';
      $shell = New-Object -ComObject Shell.Application;
      $wshell = New-Object -ComObject WScript.Shell;
      $found = $false;

      foreach ($win in $shell.Windows()) {
          try {
              # Convert URL (file:///C:/...) to Local Path (C:...)
              $path = [Uri]$win.LocationURL;
              $localPath = $path.LocalPath;
              
              # Compare paths (Case insensitive standard in PS)
              if ($localPath -eq $target) {
                  # Found it! Bring to front.
                  $wshell.AppActivate($win.LocationName); 
                  $found = $true;
                  break;
              }
          } catch {}
      }

      if (-not $found) {
          # Not open, launch it
          Invoke-Item $target;
      }
    `;

    try {
      Bun.spawn(["powershell", "-NoProfile", "-Command", psCommand], {
        stdio: ["ignore", "ignore", "ignore"], // Fire and forget, keep CLI clean
      });
    } catch {
      // Fallback if PowerShell fails
      spawn("explorer", [targetPath], { detached: true }).unref();
    }
    return;
  }

  // 🍎🐧 MAC/LINUX FALLBACK (Standard Open)
  const cmd = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(cmd, [absPath], { stdio: "ignore", detached: true }).unref();
}

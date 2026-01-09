import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Helper to simulate __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Going up one level from src/constants to src, then up to root to find bin/generated
// Actually, let's keep it relative to the package root.
// If this file is in src/constants/defaults.ts, then root is ../../
const ROOT_DIR = join(__dirname, "../../");

export const SYSTEM = {
  VERSION: "13.0.0-ai",
  ROOT_DIR,
  FILENAME: __filename,
  OUT_DIR: join(ROOT_DIR, "generated"),
  BIN_DIR: join(ROOT_DIR, "bin"),
  AUTH_FILE: join(ROOT_DIR, "bin", "auth.config.json"), // Global auth storage in bin
  CONCURRENCY: 64,
  CHUNK_SIZE: 64 * 1024,
};

export const DEFAULT_CONFIG = {
  ignoredPatterns: [
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "out",
    "target",
    "bin",
    "obj",
    ".output",
    "coverage",
    ".vercel",
    ".vscode",
    ".idea",
    "__pycache__",
    ".env",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "package-lock.json",
    "assets",
    "public",
    "jspm_packages",
    "vendor",
    ".contentlayer",
    "prompter.config.json",
    "auth.config.json",
  ],
  ignoredExts: [
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
    ".ico",
    ".webp",
    ".gif",
    ".mp4",
    ".mp3",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".exe",
    ".dll",
    ".bin",
    ".so",
    ".dylib",
    ".sys",
    ".sqlite",
    ".db",
    ".otf",
    ".ttf",
    ".woff",
    ".woff2",
    ".eot",
    ".o",
    ".obj",
    ".rmeta",
    ".rlib",
    ".d",
    ".pdb",
    ".lock",
    ".tsbuildinfo",
  ],
  maxFileSizeKB: 500,
};

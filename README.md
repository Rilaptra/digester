# ⚡ DIGESTER


<div align="center">

```text
░███████   ░██                                    ░██                       
░██   ░██                                         ░██                       
░██    ░██ ░██ ░████████  ░███████   ░███████  ░████████  ░███████  ░██░████
░██    ░██ ░██░██    ░██ ░██    ░██ ░██           ░██    ░██    ░██ ░███    
░██    ░██ ░██░██    ░██ ░█████████  ░███████     ░██    ░█████████ ░██     
░██   ░██  ░██░██   ░███ ░██               ░██    ░██    ░██        ░██     
░███████   ░██ ░█████░██  ░███████   ░███████      ░████  ░███████  ░██     
                     ░██                                                    
               ░███████                                                     
```

![Version](https://img.shields.io/badge/Version-17.5.1--ai-blue?style=for-the-badge&logo=git)
![Runtime](https://img.shields.io/badge/Runtime-Bun_v1.2+-black?logo=bun&style=for-the-badge)
![Security](https://img.shields.io/badge/Security-Secret_Scan-red?style=for-the-badge&logo=shield)
![Build](https://img.shields.io/badge/Build-Native_Binary-green?style=for-the-badge)

> **The Ultimate AI Operations Agent & Codebase Context Engine.**
> Built for speed on low-end hardware. Zero dependencies bloat. 100% Bun Native.

**Digester** is not just a context generator. It is a highly optimized CLI toolkit that turns your codebase into a liquid format for LLMs, automates your Git workflows with AI, traces dependencies, and protects your secrets—all running on a toaster-friendly memory footprint.

</div>

---

## 🌟 Why Digester?

- **⚡ Blazingly Fast:** Powered by Bun, scanning thousands of files in milliseconds.
- **🎨 Custom TUI Engine:** No heavy prompt libraries. Built-in, zero-allocation UI components (Grid Select, Editors, Spinners).
- **🛡️ Security Guard:** AI scans your staged changes for leaked secrets (API Keys, tokens) _before_ you commit.
- **🧠 Dependency Tracing:** Recursively maps out imports from an entry point to create a focused context graph.
- **🌍 Remote Ops:** Clone, scan, and digest remote GitHub repositories in temporary sandboxes without polluting your disk.

---

## 🚀 Key Features

### 1. 🤖 AI Auto-Ops Agent

Stop writing commit messages manually.

- **Auto-Commit:** Analyzes `git diff`, writes Conventional Commits, and generates a bullet-point Changelog.
- **Auto-Version:** Smart SemVer bumping (Major/Minor/Patch) based on code analysis.
- **Pre-Push Hooks:** Runs configured scripts or TS files before pushing to ensure quality.

### 2. 🗺️ Code Cartography

Understand your project instantly.

- **`digest tree`:** Visualize your project structure with smart file-type icons.
- **`digest trace`:** Generate a markdown digest _only_ for files related to a specific entry point (e.g., `src/index.ts`).
- **`digest git`:** Digest a remote repo URL directly (e.g., `digest git user/repo`).

### 3. 🛠️ Developer Experience (DX)

- **Auto-Build Watcher:** `digest autobuild` watches changes and recompiles with audio feedback.
- **Scaffolder:** `digest gen` creates new Commands or Managers instantly.
- **Self-Healing:** `digest update` pulls the latest version of itself and rebuilds locally.

---

## 📥 Installation

Digester is optimized for **Bun**. Ensure you have it installed.

### Option A: From Source (Recommended)

```bash
# 1. Clone
git clone https://github.com/Rilaptra/digester.git
cd digester

# 2. Install Deps
bun install

# 3. Build & Setup (Adds to PATH)
bun run setup
```

### Option B: Quick Start (Dev Mode)

```bash
bun install
bun run dev
```

---

## 🎮 Command Reference

| Command            | Alias     | Description                                                |
| :----------------- | :-------- | :--------------------------------------------------------- |
| `digest scan`      | `.`       | Scan current directory and generate context.               |
| `digest commit`    | `ci`      | **AI Agent:** Auto-commit, version bump, changelog, push.  |
| `digest check`     | `ck`      | Scan staged changes for secret leaks/security risks.       |
| `digest git`       | `clone`   | Clone & digest a remote Git repository (URL or user/repo). |
| `digest trace`     | `deps`    | Trace dependencies recursively from an entry file.         |
| `digest tree`      | `t`       | Display project structure with icons & stats.              |
| `digest source`    | `src`     | Self-digest: Scan the Digester source code itself.         |
| `digest gen`       | `new`     | Scaffold new Commands or Managers.                         |
| `digest config`    | `init`    | Generate default `prompter.config.json`.                   |
| `digest autobuild` | `dev`     | Watch mode with auto-recompile & sound alerts.             |
| `digest update`    | `upgrade` | Self-update Digester from the repo.                        |
| `digest set-key`   | `auth`    | Set your Google Gemini API Key.                            |
| `digest set-model` | `model`   | Switch AI Models (Flash/Pro).                              |

---

## ⚙️ Configuration

Customize behavior via `prompter.config.json`:

```json
{
  "ignoredPatterns": ["node_modules", "dist", ".git", ".next"],
  "ignoredExts": [".png", ".jpg", ".lock", ".tsbuildinfo"],
  "maxFileSizeKB": 500,
  "prePushScripts": ["lint", "test"]
}
```

---

## 🛡️ Architecture & Stack

Designed for **Resilience** and **Performance**.

- **Runtime:** [Bun](https://bun.sh) (Native Spawn, IO, SQLite)
- **Language:** TypeScript 5.0 (Strict)
- **Architecture:**
  - **Core:** `Scanner`, `DependencyTracer`, `CommandLoader`
  - **Managers:** `AIManager` (Gemini), `GitManager`, `ConfigManager`
  - **Utils:** Zero-alloc Logger, Custom TUI System
- **Linter/Formatter:** Biome

---

## 👤 Author

**(Rilaptra)**

- 🌐 [Eryzsh Dashboard](https://erzysh.vercel.app)
- 🐙 [GitHub](https://github.com/Rilaptra)

---

> _"Code by Human, Optimized by Logic, Powered by AI."_ ⚡

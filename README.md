# ⚡ Digester CLI

> **The Ultimate Codebase Digester for LLM Context.**  
> Stop copy-pasting files manually. Feed your entire project context to ChatGPT, Claude, or DeepSeek in seconds.

![Bun](https://img.shields.io/badge/Runtime-Bun_v1.0+-black?logo=bun&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Stable_v11.4-purple?style=for-the-badge)

---

## 📖 What is Digester?

**Digester** is a high-performance CLI tool built with **Bun** & **TypeScript** designed to scan your codebase, generate a visual file tree, and concatenate relevant source code into a single Markdown file.

This "digest" is optimized for Large Language Models (LLMs), allowing you to provide full context for code review, refactoring, or feature implementation without hitting token limits with garbage files.

## 🚀 Key Features

- **⚡ Blazing Fast:** Powered by Bun runtime & asynchronous concurrency.
- **🌳 Tree Visualization:** Generates a clean ASCII directory structure.
- **🛡️ Smart Ignoring:** Automatically skips `node_modules`, lockfiles, binary files (`.exe`, `.png`, etc.), and respects `.gitignore`.
- **⚙️ Fully Configurable:** Customize ignore patterns and file size limits via `prompter.config.json`.
- **💻 Global Command:** Includes a setup wizard to install the `digest` command to your system PATH (Windows).
- **📝 Markdown Output:** Produces syntax-highlighted markdown ready for LLM consumption.

---

## 🛠️ Installation & Setup

You don't need to run this locally every time. Install it globally once!

### 1. Clone the Repository
```bash
git clone https://github.com/Rilaptra/digester.git
cd digester
```

### 2. Install Dependencies
Make sure you have [Bun](https://bun.sh) installed.
```bash
bun install
```

### 3. Run Setup Wizard (Windows)
This command will generate a `.bat` shim and automatically add the tool to your System Environment Variables.
```bash
bun run index.ts setup
```
*> **Note:** Restart your terminal (VSCode/CMD/PowerShell) after setup to apply changes.*

---

## 🎮 Usage

Once installed, use the `digest` command anywhere in your terminal.

### Basic Scan
Scan the current directory:
```bash
digest
# or
digest .
```

### Scan Specific Folder
Scan a specific project or subdirectory:
```bash
digest ./src/components
# or
digest E:\Projects\MyCoolApp
```

### Generate Config
Create a default configuration file in the current directory:
```bash
digest config
```

### Help & Info
Show the manual and version info:
```bash
digest help
```

---

## ⚙️ Configuration (`prompter.config.json`)

Digester looks for a config file in your target directory. If not found, it uses smart defaults.

```json
{
  "ignoredPatterns": [
    "node_modules", ".git", ".next", "dist", "build", "coverage", ".env"
  ],
  "ignoredExts": [
    ".png", ".jpg", ".zip", ".exe", ".dll", ".lock"
  ],
  "maxFileSizeKB": 500
}
```

---

## 📂 Output Format

The generated file is saved in the `generated/` folder within the tool's directory. It opens automatically upon completion.

**Example Output:**

````markdown
# Project Name

## Tree
```
├── src
│   ├── index.ts
│   └── utils.ts
├── package.json
└── tsconfig.json
```

## Code

// --- src/index.ts ---
```typescript
console.log("Hello World");
```

// --- package.json ---
```json
{ "name": "demo" }
```
````

---

## 🏗️ Architecture

- **Runtime:** Bun (v1.x)
- **Language:** TypeScript
- **Pattern:** Object-Oriented Programming (OOP)
- **Core Modules:**
  - `Scanner`: Handles recursive directory walking and filtering.
  - `ConfigManager`: Loads and merges user settings.
  - `AppController`: Manages CLI dispatching and logic.

---

## 👤 Author

**Rizqi Lasheva (Rilaptra / Erzy.sh)**  

- 🌐 [Website](https://erzysh.vercel.app)
- 🐙 [GitHub](https://github.com/Rilaptra)

---
> Made with ❤️ and ☕

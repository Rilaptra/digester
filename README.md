# ⚡ Digester CLI

> **The Ultimate Codebase Digester & AI Ops Agent.**  
> Stop copy-pasting files manually. Stop writing boring commit messages. Let AI handle your entire workflow.

![Bun](https://img.shields.io/badge/Runtime-Bun_v1.0+-black?logo=bun&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google-gemini&style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
[![GitHub Release](https://img.shields.io/github/v/release/Rilaptra/digester?style=for-the-badge&color=orange)](https://github.com/Rilaptra/digester/releases)

---

## 📖 What is Digester?

**Digester** is a high-performance CLI tool built with **Bun** & **TypeScript**. Originally designed to convert your codebase into a single context file for LLMs, it has evolved into a powerful **AI Operations Agent**.

It doesn't just read code; it helps you maintain it.

## 🚀 Key Features

### 🧠 Core Features (Context Generation)
- **⚡ Blazing Fast:** Scans thousands of files in milliseconds using Bun.
- **🌳 Tree Visualization:** Generates a clean ASCII directory structure.
- **🛡️ Smart Ignoring:** Respects `.gitignore` + smart defaults (skips `node_modules`, lockfiles, binary files).
- **📝 Markdown Output:** Produces syntax-highlighted markdown ready for ChatGPT/Claude/DeepSeek.

### 🤖 AI Auto-Ops (New in v12!)
- **✍️ Auto-Commit:** AI analyzes your `git diff` and writes Conventional Commit messages.
- **📈 Auto-Versioning:** Automatically bumps `package.json` version (Major/Minor/Patch) based on code changes.
- **📜 Auto-Changelog:** Appends meaningful updates to `CHANGELOG.md` automatically.
- **🚀 Auto-Push:** One command to Commit, Tag, and Push to remote.

---

## 🛠️ Installation & Setup

### 1. Clone & Install
```bash
git clone https://github.com/Rilaptra/digester.git
cd digester
bun install
```

### 2. Global Setup (Windows)
Run the setup wizard to add `digest` to your system PATH.
```bash
bun run index.ts setup
```
*> **Note:** Restart your terminal after setup.*

### 3. Configure AI (One-time Setup)
To use the Auto-Commit features, you need a free Google Gemini API Key.
```bash
# Set your API Key
digest set-key AIzaSyYourKeyHere...

# (Optional) Select specific model
digest set-model
```

---

## 🎮 Usage

### 1. Digging Context (The Original Feature)
Generate a markdown digest of your current directory to feed into an LLM.
```bash
# Scan current folder
digest

# Scan specific path
digest ./src/components
```

### 2. AI Auto-Maintenance (The Cool Feature)
Lazy to write commits? Let Digester handle the entire Git lifecycle for this repo.
```bash
digest commit
```
**What happens when you run this?**
1.  🤖 **Scans Changes:** Checks staged/unstaged files.
2.  🧠 **AI Analysis:** Sends the diff to Gemini to generate a commit message & changelog.
3.  🔢 **SemVer Bump:** Decides if it's a Patch, Minor, or Major update.
4.  📝 **Updates Files:** Modifies `package.json` and `CHANGELOG.md`.
5.  💾 **Git Action:** Performs `git add`, `git commit`, and `git tag`.
6.  🚀 **Deploy:** Automatically pushes code & tags to GitHub.

---

## ⚙️ Configuration

### Project Config (`prompter.config.json`)
Placed in your target project root.
```json
{
  "ignoredPatterns": ["node_modules", ".git", "dist", ".env"],
  "maxFileSizeKB": 500
}
```

### Global Auth (`bin/auth.config.json`)
Auto-generated when you run `digest set-key`. Stores your API credential securely in the installation folder, not in your project.

---

## 🏗️ Architecture

- **Runtime:** Bun (v1.x)
- **Language:** TypeScript
- **AI Engine:** Google Gemini (Flash/Pro)
- **Modules:**
  - `Scanner`: Recursive directory walking.
  - `AIManager`: Bridge to Google Generative AI.
  - `GitManager`: Wrapper for Git automation.

---

## 👤 Author

**Rizqi Lasheva (Rilaptra)**  

- 🌐 [Website](https://erzysh.vercel.app)
- 🐙 [GitHub](https://github.com/Rilaptra)

---
> *Maintained by AI, Code by Human.* ❤️
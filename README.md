# ⚡ Digester CLI

![Version](https://img.shields.io/badge/Version-16.9.0--ai-blue?style=for-the-badge)

> **The Ultimate Codebase Digester & AI Operations Agent.**  
> Stop copy-pasting code fragments. Stop writing mechanical commit messages. Let AI handle your entire maintenance workflow.

![Bun](https://img.shields.io/badge/Runtime-Bun_v1.0+-black?logo=bun&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue?logo=typescript&style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Google_Gemini-8E75B2?logo=google-gemini&style=for-the-badge)
![Efficiency](https://img.shields.io/badge/Optimization-Low--End_Memory-green?style=for-the-badge)

---

## 📖 What is Digester?

**Digester** is a high-performance CLI tool built with **Bun** & **TypeScript**. Originally designed to convert codebases into high-context markdown for LLMs, it has evolved into a full-scale **AI Operations Agent**.

In v13, we've optimized every byte and cycle, ensuring it runs smoothly even on restricted hardware while providing a premium, aesthetic terminal experience.

---

## 🚀 Key Features

### 🧠 Intelligent Context Generation
- **⚡ Zero-Lag Scanning:** Processes thousands of files in milliseconds.
- **🌳 Architecture Tree:** Generates clean, visual directory structures.
- **🛡️ Smart Filtering:** Automatically respects `.gitignore` and skips heavy binary/lock files.
- **📝 LLM-Ready Output:** Formats your entire project into a single markdown file with syntax highlighting.
- **🔍 Self-Digestion:** Quickly scan the tool's own source code using the \`source\` command.

### 🤖 AI Auto-Ops (Self-Maintenance)
- **✍️ Auto-Commit:** AI analyzes your `git diff` to write meaningful Conventional Commits.
- **📈 Smart Versioning:** Automatically bumps `package.json` (SemVer) based on logic changes.
- **📜 Prepend Changelog:** Maintains a chronological `CHANGELOG.md` with version headers.
- **🚀 One-Tap Deploy:** Commits, Tags, and Pushes to remote in a single flow.

### 🎨 Premium Developer Experience
- **✨ Aesthetic Logging:** Beautifully formatted, color-coded terminal output with timestamps and caller tracking.
- **💾 Memory Efficient:** Built for developers on 4GB-8GB machines; zero-allocation patterns during logging.
- **🛠️ Integrated Tooling:** Built-in commands to open source directories and manage configurations.

---

## 🎮 Commands Reference

| Command | Alias | Description |
| :--- | :--- | :--- |
| `digest` | `.` | Scan current directory and generate digest. |
| `digest <path>` | - | Scan a specific directory. |
| `digest commit` | `ci` | AI-Powered automatic commit, versioning, and push. |
| `digest config` | `init` | Generate a default `prompter.config.json`. |
| `digest open` | - | Open the Digester source code directory. |
| `digest set-key` | `auth` | Save your Google Gemini API Key. |
| `digest set-model` | `model` | Select between different Gemini models (Flash/Pro). |
| `digest source` | `src`, `self` | Quick digest of the project's own source code. |
| `digest setup` | - | Global installation wizard (Add to PATH). |

---

## 🛠️ Installation & Setup

### 1. Simple Install
```bash
git clone https://github.com/Rilaptra/digester.git
cd digester
bun install
```

### 2. Build
Run the build command to build the `start` command.
```bash
bun run build
```

### 3. Setup
Run the setup command to add the `digest` command to your PATH.
```bash
bun start setup
```
*> **Note:** Restart your terminal to refresh the environment variables.*

### 4. AI Authentication
Get a free API Key from [Google AI Studio](https://aistudio.google.com/).
```bash
digest set-key YOUR_API_KEY
digest set-model # Recommended: gemini-flash-latest
```

---

## ⚙️ Configuration

Customized behavior per project via `prompter.config.json`:

```json
{
  "ignoredPatterns": ["node_modules", ".git", "dist", ".next"],
  "ignoredExts": [".png", ".jpg", ".exe"],
  "maxFileSizeKB": 500
}
```

---

## 🏗️ Architecture

- **Runtime:** Bun (Native File I/O & Spawn)
- **Language:** TypeScript 5.x
- **AI Engine:** Google Gemini API
- **Modules:**
  - `Scanner`: Recursive tree-walking with regex filtering.
  - `AIManager`: JSON-mode prompt engineering for Git operations.
  - `GitManager`: Versioning and lifecycle automation.
  - `Logger`: High-performance terminal formatter.

---

## 👤 Author

**Rizqi Lasheva (Rilaptra)**  
*Computer Engineering Junkie & Automation Enthusiast.*

- 🌐 [Portfolio](https://erzysh.vercel.app)
- 🐙 [GitHub](https://github.com/Rilaptra)

---
> *Code by Human, Maintained by AI.* ❤️
# digester

> AI-powered CLI toolkit for automated commits, code scanning, dependency tracing, and developer workflow automation. Built with [Bun](https://bun.sh) ⚡

[![npm version](https://img.shields.io/npm/v/@rilaptra/digester.svg)](https://www.npmjs.com/package/@rilaptra/digester)
[![license](https://img.shields.io/npm/l/@rilaptra/digester)](https://github.com/rilaptra/digester/blob/main/LICENSE)

---

## ✨ Features

| Category | Capabilities |
|----------|-------------|
| 🤖 **AI Auto-Commit** | Conventional commit messages, changelogs, version bumps, tags & push — all powered by Google Gemini |
| 🛡️ **Secret Scanner** | Detect potential secret leaks in staged changes *before* they reach the remote |
| 📂 **Code Scanner** | Digest & analyze codebases with token estimation, file statistics & extension distribution |
| 🔗 **Dependency Tracer** | Resolve and visualize file import/require dependency graphs |
| 🌳 **Project Tree** | Beautiful file tree with smart folder icons, colors, and folder summaries |
| 🔄 **Auto-Build Watcher** | File watcher with native OS audio/visual feedback for instant rebuilds |
| 🎨 **ANSI Art Generator** | Create gradient ANSI text art from strings or files with custom colors |
| 🖥️ **Interactive TUI** | Select, MultiSelect, Confirm, AutoComplete, TreeSelect, Editor, SpinNumber, TextPrompt |
| 📦 **Cross-Platform** | Pre-compiled binaries for Windows, Linux, and macOS (ARM + Intel) |
| 🚀 **CI/CD** | Automated GitHub Releases & NPM publishing on tag push |

---

## 📦 Installation

### Via NPM

```bash
bun add -g @rilaptra/digester
# or
npm install -g @rilaptra/digester
```

### Via Binary (GitHub Releases)

Download the latest binary for your platform from [Releases](https://github.com/rilaptra/digester/releases):

| Platform | Architecture | File |
|----------|-------------|------|
| 🏠 Windows | x64 | `digester-win-x64.exe` |
| 🐧 Linux | x64 | `digester-linux-x64` |
| 🍎 macOS | ARM (M1+) | `digester-macos-arm64` |
| 🍎 macOS | Intel | `digester-macos-x64` |

```bash
# Linux/macOS — make executable and move to PATH
chmod +x digester-linux-x64
sudo mv digester-linux-x64 /usr/local/bin/digest
```

---

## 🚀 Quick Start

```bash
# 1. Set your Google Gemini API key
digest set-key

# 2. Choose your AI model
digest set-model

# 3. AI auto-commit (message + changelog + version bump + tag + push)
digest commit

# 4. Scan your project
digest scan

# 5. Visualize project structure
digest tree

# 6. Watch and auto-rebuild
digest autobuild
```

> **Note:** The CLI can be invoked as `digest` or `prompter` (backward-compatible alias).

---

## 📋 Commands

| Command | Aliases | Description |
|---------|---------|-------------|
| `commit` | `ci` | AI auto-commit with changelog, version bump & tag |
| `scan` | — | Scan and digest codebase |
| `check` | `ck` | Scan staged changes for secret leaks |
| `tree` | — | Display project structure with smart icons & colors |
| `trace` | — | Trace and visualize file dependency graph |
| `git` | — | Clone, scan & digest remote Git repositories |
| `autobuild` | `dev`, `watch`, `live` | Watch files & rebuild with audio/visual feedback |
| `config` | — | Interactive configuration editor with autocomplete |
| `set` | — | Manage global settings (model, API key, etc.) |
| `set-key` | — | Set Google Gemini API key |
| `set-model` | — | Set AI model |
| `gen` | — | Scaffold new commands & managers |
| `src` | `source`, `srccode`, `self` | Scan digester's own source code |
| `ansi` | `art`, `gradient` | Generate ANSI gradient art from text or file |
| `open` | — | Open project in VS Code, Explorer, or system editor |
| `update` | — | Self-update digester via Git |
| `setup` | — | Initial setup wizard |
| `help` | — | Show help |
| `hard-restart` | — | Force complete rebuild & restart |
| `test` | — | Interactive TUI component demos & tests |

---

## ⚙️ Configuration

Digester stores configuration in `auth.config.json` for API keys and model preferences.

```bash
# Interactive config editor (with autocomplete support)
digest config

# Quick setup
digest set-key            # Interactive prompt for Gemini API key
digest set-model          # Choose your preferred AI model
digest set                # Centralized settings menu
```

**Default AI Model:** `gemini-flash-latest`

---

## 🏗️ Architecture

```
src/
├── commands/          # 20 CLI commands (auto-registered via codegen)
│   └── index.ts       # ⚠️ Auto-generated registry — do not edit manually
├── core/
│   ├── AppController  # Application lifecycle controller
│   ├── BaseCommand    # Base class with prompt utilities, spinners, TUI helpers
│   ├── CommandLoader  # Static command loading from generated registry
│   ├── Scanner        # File scanning engine with ignore/force-include logic
│   └── DependencyTracer # Import/require graph resolver
├── managers/
│   ├── AIManager      # Google Gemini API integration
│   ├── ConfigManager  # Configuration read/write with persistence
│   ├── GitManager     # Git operations (diff, init, remote, tag, push)
│   └── SystemManager  # System health checks & metadata caching
├── constants/         # Default configurations
├── types/             # TypeScript type definitions
└── utils/
    ├── logger         # Zero-allocation centralized logger
    ├── filesystem     # File system utilities
    ├── formatting     # Token estimation & text formatting
    ├── explorer       # File explorer (TreeSelect-based)
    └── tui/           # Interactive TUI components
        ├── Select         # Grid-based selection menu
        ├── MultiSelect    # Multi-option grid selector
        ├── Confirm        # Boolean prompt
        ├── TextPrompt     # Text input with validation
        ├── AutoComplete   # Fuzzy & prefix suggestion input
        ├── Editor         # Full editor with resize & history
        ├── SpinNumber     # Numeric spinner
        └── TreeSelect     # Interactive file tree navigation
```

### Design Principles

- **Static Registry** — Commands are registered via `bun run codegen` (not dynamic FS scan), ensuring bundle compatibility
- **Zero-Allocation Logger** — Centralized `generateLog()` replaces all `console.*` calls for performance
- **Native Feedback** — Audio/visual build feedback using OS-native commands (no external deps)
- **Force-Include Logic** — Scanner's `forceInclude` bypasses ignore patterns for specific files/folders

---

## 🛠️ Development

```bash
# Install dependencies
bun install

# Generate command registry (required after adding/removing commands)
bun run codegen

# Build
bun run build

# Development mode (watch + auto-rebuild with sound feedback)
bun run dev
# or
digest autobuild

# Lint & Format
bunx biome check --apply .
```

### Adding a New Command

```bash
# Scaffold a new command
digest gen

# Then regenerate the registry
bun run codegen
```

---

## 🚀 Release

Pushing a version tag triggers the full CI/CD pipeline:

```bash
git tag v17.8.0-ai
git push origin v17.8.0-ai
```

The workflow (`.github/workflows/release.yml`) automatically:

1. 🔨 Builds the package & publishes to **NPM**
2. 🪟🐧🍎 Cross-compiles binaries for all platforms
3. 🎉 Creates a **GitHub Release** with attached binaries & auto-generated release notes

---

## 📜 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full release history.

---

## 📄 License

MIT © [Rilaptra](https://github.com/rilaptra)
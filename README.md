# 🤖 Digester CLI

![Version](https://img.shields.io/badge/Version-17.10.0--ai-blue?style=for-the-badge)

> The Ultimate Codebase Digester + AI Ops Agent

![Runtime](https://img.shields.io/badge/runtime-Bun-black?logo=bun)
![Language](https://img.shields.io/badge/language-TypeScript-blue?logo=typescript)
![Linter](https://img.shields.io/badge/linter-Biome-green)

**Digester** adalah CLI tool serbaguna yang menggabungkan analisis codebase, AI-powered git operations, dan developer workflow automation dalam satu alat.

Dibuat oleh **Rilaptra**

---

## 🚀 Fitur Utama

| Kategori | Fitur | Perintah |
|---|---|---|
| 🔍 Scanning | Scan & digest codebase lokal | `digest scan` |
| 🌐 Remote | Clone & digest remote git repo | `digest git <url>` |
| 🤖 AI Commit | Auto-commit, changelog, version bump | `digest commit` |
| 🛡️ Security | Deteksi secret leak di staged changes | `digest check` |
| ⚡ Auto-Build | Watch & rebuild otomatis | `digest autobuild` |
| 🏗️ Scaffold | Buat Command/Manager baru | `digest gen` |
| 🎨 ANSI Art | Generate ANSI gradient art | `digest ansi` |
| 📦 Self-Update | Update CLI ke versi terbaru | `digest update` |
| 🔑 Config | Set API key & model AI | `digest set-key`, `digest set-model` |
| 🌳 Dependency | Trace & tree dependency graph | `digest trace`, `digest tree` |

---

## 📦 Instalasi

```bash
# Clone repo
git clone https://github.com/rizlaptra/digester.git
cd digester

# Install dependencies
bun install

# Build binary
bun run build
```

## ⚙️ Setup Awal

```bash
# Set API Key (Gemini/OpenAI)
digest set-key <YOUR_API_KEY>

# Pilih AI Model
digest set-model

# Atau gunakan setup interaktif
digest setup
```

## 📖 Perintah Lengkap

| Perintah | Alias | Deskripsi |
|---|---|---|
| `scan` | `s` | Scan & digest codebase lokal ke Markdown |
| `git <url>` | `clone`, `remote` | Clone & digest remote git repository |
| `commit` | `ci` | AI auto-commit dengan changelog & version bump |
| `check` | `ck` | Scan secret leak di staged changes |
| `autobuild` | `dev`, `watch`, `live` | Watch file changes & auto-rebuild |
| `gen` | `create`, `scaffold`, `new` | Scaffold Command/Manager baru |
| `config` | `init` | Generate file konfigurasi default |
| `help` | `h`, `-h`, `--help` | Tampilkan informasi bantuan |
| `ansi` | `art`, `gradient` | Generate ANSI gradient art file |
| `tree` | — | Tampilkan dependency tree |
| `trace` | — | Trace dependency antar file |
| `src` | — | Lihat source code perintah |
| `open` | — | Buka file/directory |
| `set-key <key>` | — | Set API key untuk AI |
| `set-model` | — | Set/pilih AI model |
| `set` | — | Set konfigurasi |
| `hard-restart` | `restart`, `rb`, `f5` | Force rebuild & restart |
| `update` | — | Update CLI ke versi terbaru |
| `test` | — | Jalankan test |

---

## 🏗️ Arsitektur

```
src/
├── index.ts                  # Entry point
├── commands/                 # Semua perintah CLI (auto-registered)
│   ├── index.ts              # ⚠️ AUTO-GENERATED (jangan edit manual)
│   ├── scan.ts               # Scan codebase lokal
│   ├── git.ts                # Clone & digest remote repo
│   ├── commit.ts             # AI auto-commit agent
│   ├── check.ts              # Secret leak scanner
│   ├── autobuild.ts          # Auto-rebuild watcher
│   ├── gen.ts                # Code scaffolder
│   └── ...                   # Perintah lainnya
├── core/
│   ├── AppController.ts      # Controller utama aplikasi
│   ├── BaseCommand.ts        # Base class untuk semua perintah
│   ├── CommandLoader.ts      # Dynamic command loader/registry
│   ├── DependencyTracer.ts   # Dependency graph tracer
│   └── Scanner.ts            # Core file scanner & digester
├── managers/
│   ├── AIManager.ts          # AI integration (Gemini/OpenAI)
│   ├── ConfigManager.ts      # Konfigurasi manager
│   ├── GitManager.ts         # Git operations manager
│   └── SystemManager.ts      # System-level operations
├── constants/
│   └── defaults.ts           # Default config & system constants
├── types/
│   └── index.ts              # Type definitions
└── utils/
    ├── tui/                  # Terminal UI components
    │   ├── AutoComplete.ts   # Auto-complete input
    │   ├── Confirm.ts        # Yes/No prompt
    │   ├── Editor.ts         # Editor integration
    │   ├── MultiSelect.ts    # Multi-select menu
    │   ├── Select.ts         # Single select menu
    │   ├── SpinNumber.ts     # Number spinner
    │   ├── TextPrompt.ts     # Text input prompt
    │   └── TreeSelect.ts     # Tree selection
    ├── explorer.ts           # File explorer
    ├── filesystem.ts         # File system utilities
    ├── formatting.ts         # Text formatting utilities
    ├── logger.ts             # Logging system
    └── index.ts              # Utils barrel export
```

## 🔄 Alur Command Registry (Codegen)

```
scripts/generate-registry.ts
        │
        ▼
  Scan src/commands/*.ts
        │
        ▼
  Filter & Sort alphabetically
        │
        ▼
  Generate src/commands/index.ts
  (export * from "./scan.js")
  (export * from "./commit.js")
  ...
```

Jalankan dengan: `bun run codegen`

---

## 🤖 Alur AI Commit Agent

```
User: digest commit
        │
        ▼
  ┌─ Cek Git Repo ────── Tidak? ──► Init Git (interaktif)
  │
  ├─ Cek Remote ──────── Tidak? ──► Add Remote (interaktif)
  │
  ├─ Cek Release Workflow ─ Tidak? ─► Pilih: Standard / Binary Build
  │
  ├─ Cek API Key ──────── Tidak? ──► Error: set-key dulu
  │
  ├─ Git Add + Diff ───── Kosong? ──► "No changes to commit"
  │
  ├─ AI Generate ──────────────────────────────────┐
  │   (commit message, changelog, version bump,   │
  │    security check)                             │
  │                                                │
  ├─ Security Check ──── Leak? ──► Warning + Confirm
  │                                                │
  ├─ User Confirm ─────── No? ───► Aborted         │
  │                                                │
  ├─ Update Version (package.json)                 │
  ├─ Update CHANGELOG.md                           │
  ├─ Update README.md (version + command table)    │
  │                                                │
  ├─ Pre-Push Pipeline ────────────────────────────┘
  │   (run scripts/TS files before push)
  │
  ├─ Git Commit + Tag
  │
  └─ Push Strategy ──────► Direct / PR Branch / Skip
```

---

## 🔧 Konfigurasi

File: `prompter.config.json`

```json
{
  "prePushScripts": [],
  ...
}
```

Generate default: `digest config`

---

## 🛠️ Development

```bash
# Mode development (watch + auto-rebuild)
bun run dev
# atau
digest autobuild

# Generate command registry
bun run codegen

# Scaffold command baru
digest gen

# Hard restart/rebuild
digest hard-restart

# Lint
bunx biome check src/
```

---

## 📄 Output

Hasil scan/digest disimpan di folder `generated/` dalam format Markdown:

- **Lokal**: `DIGEST_<timestamp>.md`
- **Remote**: `DIGEST_REMOTE_<repo>_<timestamp>.md`

Format output berisi:
1. **Structure** — Tree view direktori
2. **Code Content** — Semua source code dengan path label

---

## 📝 Changelog

Lihat [CHANGELOG.md](./CHANGELOG.md)

## 📜 License

MIT
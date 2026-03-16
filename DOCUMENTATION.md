# ⚡ Digester Documentation

> High-performance codebase context generator and AI operations toolkit optimized for Bun.

Welcome to the official Digester documentation. Digester is designed to be the ultimate companion for AI-assisted development, providing fast, accurate, and secure context generation for Large Language Models.

---

## 📖 Table of Contents
- [Getting Started](#-getting-started)
- [Core Classes](#-core-classes)
  - [Scanner](#scanner)
  - [DependencyTracer](#dependencytracer)
  - [CommandLoader](#commandloader)
- [Managers](#-managers)
  - [SystemManager](#systemmanager)
  - [ConfigManager](#configmanager)
  - [AIManager](#aimanager)
- [TUI Components](#-tui-components)
  - [Select](#select)
  - [MultiSelect](#multiselect)
  - [AutoComplete](#autocomplete)
- [Typedefs](#-typedefs)

---

## 🚀 Getting Started

### Installation
Digester requires **Bun v1.2+**.

```bash
# Clone the repository
git clone https://github.com/Rilaptra/digester.git
cd digester

# Install dependencies
bun install

# Build and Setup (adds 'digest' to your PATH)
bun run setup
```

### Basic Usage
The most common command is `scan` (aliased to `.`):
```bash
digest .
```
This will scan your current directory, apply ignore patterns, and generate a Markdown digest of your codebase.

---

## 🏗️ Core Classes

### Scanner
The heart of Digester. A high-performance, recursive file system walker optimized for Bun.

#### Methods
- `.run(dir: string, cfg: AppConfig): Promise<ScanStats>`
  Starts a scan on the given directory using the provided configuration.

#### Example
```typescript
import { Scanner } from "./core/Scanner";
const stats = await Scanner.run(".", config);
console.log(`Scanned ${stats.files.length} files in ${stats.duration}ms`);
```

### DependencyTracer
Analyzes your code to find imports and builds a dependency graph. Useful for creating focused context.

#### Methods
- `.trace(entryFile: string, rootDir: string): Promise<Set<string>>`
  Recursively finds all local dependencies starting from `entryFile`.

#### Example
```typescript
import { DependencyTracer } from "./core/DependencyTracer";
const files = await DependencyTracer.trace("src/index.ts", process.cwd());
// Returns a Set of absolute paths
```

---

## 📂 Managers

### SystemManager
Handles system health, update checks, and notifications. Runs audits in the background to ensure your environment is up-to-date.

### ConfigManager
Handles loading and merging configurations from `prompter.config.json`, `.gitignore`, and defaults.

---

## 🎨 TUI Components

Digester features a custom, zero-allocation TUI engine.

### Select
A single-select interactive menu. Supports grid layout and pagination.

#### Methods
- `.title(text: string): this`
- `.columns(count: number): this`
- `.pageSize(count: number): this`
- `.add(label: string, value: any, meta?: object): this`
- `.run(): Promise<any>`

#### Example
```typescript
const color = await new Select<string>()
  .title("Pick a color")
  .add("Red", "#ff0000")
  .add("Blue", "#0000ff")
  .run();
```

---

## 📝 Typedefs

### AppConfig
```typescript
interface AppConfig {
  ignoredPatterns: Set<string>;
  ignoredExts: Set<string>;
  maxFileSize: number;
  prePushScripts: string[];
}
```

### ScanStats
```typescript
interface ScanStats {
  files: ScanFile[];
  tree: string[];
  skippedCount: number;
  skippedSize: number;
  totalSize: number;
  extStats: Record<string, { count: number; size: number }>;
  duration: string;
}
```

---

## 🛠️ Commands Reference
Run `digest help` for a full list of commands.

- `scan` / `.`: Scan directory.
- `commit` / `ci`: AI-powered commit.
- `trace` / `deps`: Trace dependencies.
- `tree` / `t`: Visualize project structure.
- `update`: Self-update the tool.

---

> _"Code by Human, Optimized by Logic, Powered by AI."_ ⚡

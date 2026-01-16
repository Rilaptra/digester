<div align="center">

```
      d8b d8b                    .d8888b.  888
      888 Y8P                   d88P  Y88b 888
      888                       888    888 888
  .d88888 888  .d88b.8  .d88b.  Y88b.      888888 .d88b.  888d888
 d88" 888 888 d88P"88b d8P  Y8b  "Y888b.   888   d8P  Y8b 888P"
 888  888 888 888  888 88888888     "Y88b. 888   88888888 888
 Y88b 888 888 Y88b 888 Y8b.     Y8b. d888Y Y88b. Y8b.     888
  "Y88888 888  "Y88888  "Y8888   "Y8888P"   "Y888 "Y8888  888
                   888
              Y8b d88P
               "Y88P"
```

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-Rilaptra%2Fdigester-black?style=for-the-badge&logo=github)](https://github.com/Rilaptra/digester)

**High-Performance Codebase Context Generator & AI Operations Toolkit**

_Optimized for Bun runtime._

[Report Bug](https://github.com/Rilaptra/digester/issues) · [Request Feature](https://github.com/Rilaptra/digester/issues)

</div>

---

## Overview

**Digester** is a robust Command Line Interface (CLI) tool engineered to streamline the workflow of modern developers working with Large Language Models (LLMs). By intelligently scanning, processing, and aggregating codebase context into a structured Markdown format, Digester enables seamless prompt engineering and enhances the efficiency of AI-assisted development.

Built on the **Bun** runtime, it offers exceptional performance, minimizing overhead while delivering powerful utilities for context generation, automated commit messaging, and project configuration.

## Key Features

- **Context Aggregation**: Rapidly scans directories to generate a single, token-optimized Markdown file containing your codebase structure and content, ready for LLM consumption.
- **Smart Filtering**: Automatically respects `.gitignore` and intelligently excludes binary files, lockfiles, and other non-essential artifacts to conserve token usage.
- **Tree Visualization**: Generates a clear, ASCII-based directory tree structure for better spatial understanding of the project.
- **AI Operations**: Includes utilities like `commit` for AI-generated commit messages based on staged changes.
- **Core Utilities**: specialized commands for system operations, including `hard-restart` for path correction and `open` for smart file navigation.
- **Configurable**: Fully customizable via `prompter.config.json` to tailor scanning behavior and AI model preferences.

## Installation

Ensure you have [Bun](https://bun.sh) installed on your system.

```bash
# Clone the repository

![Version](https://img.shields.io/badge/Version-17.0.0--ai-blue?style=for-the-badge)
git clone https://github.com/Rilaptra/digester.git

# Navigate to the project directory
cd digester

# Install dependencies
bun install

# Link the binary globally
bun link
```

## Usage

Once installed, the CLI can be accessed via the `digest` command (or `prompter` if legacy aliases persist).

### Context Generation

The primary function of Digester is to scan your project and produce a digest file.

```bash
# Scan the current directory
digest scan

# Scan specific directories or files
digest scan src tests package.json
```

The output file will be saved in the `out/` directory with a timestamped filename, e.g., `DIGEST_MyProject_1763261234.md`.

### Self-Reflection

To generate a digest of the Digester tool itself (useful for meta-development):

```bash
digest src
```

### AI Commit Assistant

Generate a conventional commit message based on your currently staged changes:

```bash
digest commit
```

### Configuration Management

Manage your API keys and model configurations:

```bash
# Set your AI Model
digest set model gemini-1.5-pro

# Configure API Key
digest set key YOUR_API_KEY
```

### Utilities

- **`digest tree`**: Display the directory structure without generating a full file report.
- **`digest open`**: Interactively open files or folders in your default editor or file explorer.
- **`digest hard-restart`**: Force restart the runtime process (useful for troubleshooting path issues on Windows).

## Configuration

Digester uses `prompter.config.json` for project-specific settings. You can define custom ignore patterns and modify default behaviors here.

## Author

**Rizqi Lasheva Purnama Putra (Rilaptra)**

- **Website**: [https://erzysh.vercel.app](https://erzysh.vercel.app)
- **GitHub**: [https://github.com/Rilaptra](https://github.com/Rilaptra)

## License

This project is licensed under the MIT License.

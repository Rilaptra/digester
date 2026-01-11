# Changelog

## [15.1.0-ai] - 2026-01-11
- ✨ Introduce the `source` command (aliases: `src`, `srccode`, `self`) to scan and digest the tool's own source code.
- 🛠️ Implemented source code scanning logic using `Scanner` and `ConfigManager`.
- 📝 Added functionality to generate a detailed report including file statistics, token estimates, and skipped files.
- 📦 Implemented the ability to write the digest report to a markdown file in the `out` directory.
- ⚡️ Improved error handling and user feedback with informative messages and spinners.
- ⚙️ Added support for resolving paths and handling invalid paths gracefully.
- 📖 Enhanced report display with a CLI table and distribution of file extensions.

## [15.0.0-ai] - 2026-01-10
- ✨ Introducing interactive workflow selection for release generation!
- 🚀 Added support for cross-platform binary builds (Windows, Linux, macOS) using Bun.
- 🛠️ Refactored release workflow to allow choosing between a standard source code release and a binary build release.
- 📝 Updated release workflow file name and description for clarity.

## [14.8.0-ai] - 2026-01-10
- ✨ Enhanced the file tree command with more detailed file type icons and colors.
- 🛠️ Added a folder summary displaying the number of files and top file extensions within each directory (up to 5 extensions).
- 🎨 Improved color consistency and added support for more languages and file types (e.g., Rust, PowerShell, WASM, TOML).
- 📦 Added support for archive file types (tar, gz).
- 📝 Updated documentation and added specialized icons for Civil Engineering/Technical files (DWG, DXF, XLSX, CSV).

## [14.7.0-ai] - 2026-01-10
- ✨ Add `tree` command to display project structure with smart folder icons and media support.
-   Displays a visual tree of the project directory.
-   Uses icons for different folder types (src, core, utils, etc.).
-   Highlights files with appropriate icons and colors based on their extensions.
-   Supports limiting the depth of the tree.
-   Includes auto-depth detection and prompting for depth input.
-   Ignores files and folders based on configuration.
-   Includes a build step before commit to ensure the latest version is committed.

## [14.6.0-ai] - 2026-01-10
- ✨ **Feature**: Improved changelog formatting to support multiline entries with bullet points. Updated AI prompt to allow more flexible changelog formats and provide clearer instructions.

## [14.5.0-ai] - 2026-01-10
- ✨ **Feature**: Enhanced project name detection from git config and improved scan output with relative paths and project names.

## [14.4.0-ai] - 2026-01-10
- ✨ **Feature**: Enhanced the scan command to include interactive mode selection and support for scanning multiple target paths simultaneously.
⚡️ **Performance**: Optimized Git diff generation by enabling zero context lines (`-U0`) and filtering metadata, significantly reducing token consumption for AI analysis.

## [14.3.1-ai] - 2026-01-09
- ⚙️ **Refactor**: Load system version dynamically from `package.json` instead of using a hardcoded constant in system defaults.

### [2026-01-09]
- 📖 **Docs**: Updated documentation to recommend `gemini-flash-latest` model.

## [14.3.0-ai] - 2026-01-09
- ✨ **Enhancement**: Transitioned from dynamic command discovery (file system scanning) to static command loading via an auto-generated registry, significantly improving build compatibility and application reliability when bundled.

## [14.2.0-ai] - 2026-01-09
- ✨ **Enhancement**: Massively improved the `digest commit` command to include automatic checks for Git initialization and remote configuration, offering interactive setup and generating a GitHub Release workflow if needed. Introduced interactive push strategies (direct push or new PR branch creation).

## [14.1.0-ai] - 2026-01-09
- ✨ **Enhancement**: Added support for running the auto-commit process against the current working directory using the `commit this` command, improving flexibility.

## [14.0.0-ai] - 2026-01-09
- 🛠️ **Refactor**: Completed architectural migration, implementing a centralized, zero-allocation logger for improved performance, integrating Biome for unified code quality, and updating documentation.


## [13.0.0-ai] - 2026-01-09
- 🚀 **Major Logging Overhaul**: Implemented `generateLog` with zero-allocation patterns and aesthetic terminal formatting.
- 🛠️ **Refactored Architecture**: Migrated all console calls to the new centralized logger for better DX.
- ⚡ **Performance Optimization**: Optimized for low-end hardware (3GB-8GB RAM).
- 📜 **Changelog Prepending**: AI now automatically prepends updates to the top of `CHANGELOG.md`.
- 📖 **Documentation Revamp**: Completely redesigned `README.md` with new command references and performance badges.
- 🔧 **New Commands**: Added `config` and `open` commands for better workflow integration.
- 🏷️ **Version Sync**: Synchronized version across `package.json` and `Defaults.ts`.

## [12.0.0-ai] - 2026-01-09
- ✨ **AI Operations Launch**: Added `commit`, `set-key`, and `set-model`.
- ✍️ **Auto-Commit**: Integrated Gemini API for automated conventional commit messages.
- 📈 **Auto-Versioning**: Automatic bumping of package versions based on diff analysis.
- 🚀 **Auto-Push**: Seamless integration of Committing, Tagging, and Pushing.
- 🧹 **Changelog Maintenance**: Initial implementation of automated `CHANGELOG.md` updates.
- 🛡️ **Improved Scanning**: Enhanced `.gitignore` support and default ignore patterns.

# Changelog

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

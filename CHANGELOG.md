# Changelog

## [17.4.1-ai] - 2026-01-16
- ✨ Added NPM authentication step to the release workflow.
- This change introduces an authentication step using the `NPM_TOKEN` secret before publishing to NPM.
- This ensures secure publishing of packages to the NPM registry.
- 📝 Updated timestamp in src/commands/index.ts to reflect the latest generation time.

## [17.4.0-ai] - 2026-01-16
- ✨ Refactored the npm publishing workflow in `.github/workflows/release.yml`.
- 🛠️ Consolidated the build and publish steps for npm, improving clarity and reducing redundancy.
- 🚀 Introduced a dedicated 'Build for NPM' step to prepare the package before publishing.
- 📦 Now publishing to npm *before* building the full distribution, ensuring a clean publish.
- 📝 Updated the timestamp in `src/commands/index.ts` to reflect the latest code generation time.

## [17.3.1-ai] - 2026-01-16
- ✨ Updated build process to utilize `bun run build` for faster and more efficient builds.
- 📝 Updated timestamp in `src/commands/index.ts` to reflect the latest build generation time.

## [17.3.0-ai] - 2026-01-16
- ✨ Introduce automated npm release workflow.
- 🚀 Added a new workflow step to automatically publish the package to npm upon tag creation.
- 🔐 Implemented npm login using `actions/setup-node` and `NODE_AUTH_TOKEN`.
- 🔑 The `npm publish` command is now executed with the npm token stored as a secret.
- 📝 Updated the timestamp in `src/commands/index.ts` to reflect the latest code generation time.

## [17.2.1-ai] - 2026-01-16
- ✨ Updated the author name in README.md from 'Rizqi Lasheva (Rilaptra)' to '(Rilaptra)'.
- 📦 Renamed the npm package from `@erzy/digester` to `@rilaptra/digester` in `package.json` to reflect the author's preferred handle.
- ⚙️ Updated the generated timestamp in `src/commands/index.ts` to reflect the latest code generation time.

## [17.2.0-ai] - 2026-01-16
- ✨ Updated package name to `@rilaptra/digester` for proper scoping.
- 📦 Added `files` array to `package.json` to specify which files to include in the published package (only `dist`).
- ⚙️ Modified `module`, `main`, and `types` entries in `package.json` to point to the `dist` directory after build.
- 📝 Updated build scripts to output to `dist` directory.
- 🏷️ Added `publishConfig` to `package.json` to set access to `public`.
- 🧹 Added necessary files and directories to `.npmignore` to prevent unwanted files from being published.
- 📜 Updated timestamp in `src/commands/index.ts` to reflect the latest changes.

## [17.1.0-ai] - 2026-01-16
- ✨ Introduce the `ansi` command for generating ANSI gradient art.
- Supports text input or reading from a file.
- Customizable start and end colors.
- Configurable output filename.
- Interactive prompts for ease of use.
- Includes color parsing and gradient calculation logic.
- Uses Bun's color library for ANSI code generation.
- Handles empty lines and ensures proper formatting.

## [17.0.0-ai] - 2026-01-16
- ✨ Renamed the CLI from `prompter` to `digester` for better clarity and branding.
- 📝 Updated the README with a new logo, description, and overview of the tool's capabilities.
- 🛠️ Modified the `package.json` to reflect the name change, add versioning, description, repository details, keywords, author information, and license.
- ⚙️ Updated the `bin` section in `package.json` to include both `digest` and `prompter` aliases for backward compatibility.
- 📖 Revised the documentation to reflect the new name and features, including installation instructions, usage examples, and configuration options.
- 🚀 Improved the overall developer experience with a more polished and informative README.

## [16.9.0-ai] - 2026-01-16
- ✨ Implemented recursive file system navigation for the 'cd' command.
- Users can now tab-complete directory paths, providing a more intuitive experience.
- The autocomplete functionality now dynamically suggests files and folders based on the current path.
- ⚙️ Added a context-aware config setter demo.
- The 'set' command now provides suggestions based on the previous words entered.
- A mock config schema is used to demonstrate the dynamic suggestion functionality.
- 🛠️ Refactored autocomplete component for better flexibility and maintainability.
- Introduced `AutoCompleteSuggester` type for dynamic suggestion functions.
- Added `separator` and `initialValue` options to the `AutoComplete` component.
- 🧹 Improved code clarity and removed unnecessary comments.
- 🐛 Fixed a bug where the autocomplete suggestions were not being filtered correctly.

## [16.8.1-ai] - 2026-01-16
- ✨ Improved the commit workflow by adding commas to prompts for better readability.
- 🚀 Added functionality to update the README file with the new version number and command list after a release.
- 🛠️ Enhanced error handling and messaging in various parts of the commit process.
- 📝 Updated the generated timestamp in index.ts to reflect the latest changes.
- ⚙️ Refactored code for better consistency and maintainability.

## [16.8.0-ai] - 2026-01-16
- ✨ Added audio and visual feedback to the autobuild command for a better developer experience.
- 📝 Updated the README.md file to include a version badge and automatically generated commands table.
- 🛠️ Implemented a mechanism to update the version badge in the README.md file.
- ⚡️ Automated the generation of the commands table in the README.md file by scanning the `src/commands` directory.
- ⚙️ Added utility functions for setting the terminal title and playing system sounds.
- 🧹 Refactored code for better readability and maintainability.

## [16.7.0-ai] - 2026-01-16
- ✨ Implement auto-build command for automatic recompilation on file changes.
- 🛠️ Refactor commands to use a consistent prompt interface with TUI components.
- ⚡️ Add interactive tests for TUI components (Select, MultiSelect, Confirm, Editor, SpinNumber).
- 📝 Update commands to use the new prompt utilities for a more consistent user experience.
- 🧹 Clean up and refactor various utility functions for improved readability and maintainability.
- 🐛 Fix minor issues in existing commands related to prompt handling and error messages.

## [16.6.0-ai] - 2026-01-16
- ✨ Added interactive TUI elements for enhanced user experience.
- 📝 Implemented a `Confirm` class for boolean prompts, allowing users to confirm actions.
- ⌨️ Introduced a `TextPrompt` class for text input with validation and password support.
- 🔍 Integrated an `AutoComplete` class for providing suggestions during input, improving usability.
- ⚙️ Refactored `src/utils/index.ts` to export the new TUI components.
- 📜 Added example usage of the new components in `src/commands/test.ts` to demonstrate their functionality.

## [16.5.0-ai] - 2026-01-15
- ✨ Implemented a stress test for TUI Pagination & Grid system to evaluate performance with large datasets.
- 📝 Updated the `test.ts` command to include tests for vertical pagination (100 items, 7 visible), grid pagination (60 items, 4 columns, 5 rows), and a new multi-select grid feature.
- 📦 Added a new `MultiSelect` component for selecting multiple options in a grid layout with pagination.
- ⚙️ Introduced dynamic column width calculation for better grid alignment.
- 🎨 Improved visual presentation with icons, colors, and clear indicators.
- ⚡️ Added scrollbar indicators for pagination.
- 🧹 Refactored code for better readability and maintainability.
- 🐛 Fixed potential issues with empty slots in grid rendering.

## [16.4.0-ai] - 2026-01-15
- ✨ Introduced a new `Select` component for interactive menu creation.
- 📝 Added builder methods (`title`, `columns`, `add`, `separator`) for configuring the `Select` component.
- 🚀 Implemented a runner engine (`run`) to handle user input and selection.
- 🎨 Enhanced rendering with icons, colors, and descriptions for improved visual clarity.
- 🛠️ Added support for grid layouts with configurable column counts.
- ⚙️ Implemented disabled states for options with visual indicators.
- 🐛 Fixed logic for icon display, prioritizing user-defined icons over disabled indicators.
- 📦 Exported the `Select` component from `src/utils/index.ts` for easy access.

## [16.3.0-ai] - 2026-01-15
- ✨ Introduce `smartOpenFolder` function for improved folder opening experience.
- 🍎🐧 On macOS and Linux, the function utilizes the standard `open` or `xdg-open` commands.
- 🪟 On Windows, the function now intelligently checks if the folder is already open.
- If open, it brings the existing window to the front.
- If not open, it opens a new instance of the folder.
- 🛠️ This enhancement provides a smoother user experience by avoiding redundant folder openings on Windows.
- 📝 Added logging to warn if the path to open does not exist.

## [16.2.1-ai] - 2026-01-15
- ✨ Refactor: Updated prompts to use `promptSelectV2` for consistent column handling.
- 📝 Refactor: Enhanced error messages during release workflow creation for better clarity.
- 🧹 Refactor: Removed deprecated `promptSelect` function and associated code.
- ⚙️ Refactor: Updated date in the generated file header.
- ⚡️ Refactor: Minor code cleanup and consistency improvements across files.

## [16.2.0-ai] - 2026-01-15
- ✨ Add `hard-restart` command to force a complete rebuild and restart of the CLI.
- 🛠️ Improve the `open` command to support opening in VS Code, Explorer, or the system default editor.
- 📝 Enhance the `scan` command with improved prompts and output formatting.
- 🔑 Add interactive prompt for Google Gemini API key in `set-key` command.
- ⚙️ Implement a `set` command to manage global settings like AI models and API keys, providing a centralized configuration menu.
- 🎨 Refactor command prompts to use `promptSelectV2` for consistent styling and behavior.


## [16.1.0-ai] - 2026-01-14
- ✨ Added a `gen` command to scaffold new commands and managers quickly.
- 📝 Implemented a `update` command for self-updating Digester to the latest version via Git.
- 🛠️ Refactored the command registry generation script for improved reliability and clarity.
- ⚙️ Enhanced the command generation process with better naming conventions and file structure.
- 📦 Updated dependencies and build process for improved performance and stability.

## [16.0.0-ai] - 2026-01-14
- ✨ Added `git` command to clone, scan, and digest remote Git repositories.
- 🚀 Implemented shallow cloning for faster repository processing.
- 🛠️ Added dependency tracing functionality with the `trace` command.
- 📝 Improved error handling and cleanup procedures for temporary directories.
- 📦 Refactored file explorer and dependency tracer for better usability.
- ⚙️ Enhanced path resolution and security checks to prevent accidental access to sensitive files.
- 🐛 Fixed potential issues with resolving .js files when source is .ts.

## [15.4.0-ai] - 2026-01-14
- ✨ Introduced `promptSelectV2` for interactive grid-based selection menus.
- 📝 Added support for configurable column layouts (1, 2, or 3 columns) in `promptSelectV2`.
- 🎮 Implemented a demo command (`test`) showcasing the grid menu with TypeScript, JavaScript, Rust, Go, Python, C++, Zig, and Odin options.
- ⚡️ Enhanced navigation within the grid using arrow keys.
- 🛠️ Improved rendering logic for the grid menu, including clearing previous lines and handling cursor visibility.
- 🧹 Refactored logger context styling for better readability.

## [15.3.0-ai] - 2026-01-11
- ✨ Introduce a new `check` command to scan staged changes for potential secret leaks.
- 🚀 Implement a secret check during the commit process to warn users before committing sensitive data.
- 🛠️ Integrate with an AI manager to analyze diffs and identify potential secrets.
- 📝 Add a `SecretCheckResult` interface to define the structure of the secret check result.
- ⚙️ Enhance the commit process to prompt users for confirmation if secrets are detected, preventing accidental commits of sensitive information.

## [15.2.0-ai] - 2026-01-11
- ✨ Introduce pre-push scripts to run checks/builds before pushing.
- 🚀 Added functionality to load and execute pre-push scripts defined in the project's configuration.
- 📝 If no scripts are configured, the user is prompted to select scripts or TypeScript files to run.
- ⚙️ Implemented retry logic for failed scripts, allowing the user to retry, continue, or abort the process.
- 📦 Added `prePushScripts` to the project configuration (defaults to an empty array).
- 🛠️ Added helper functions to list available scripts from `package.json` and TypeScript files in common directories.

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

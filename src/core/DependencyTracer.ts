/** biome-ignore-all lint/complexity/noThisInStatic: <explanation: Biome> */
/** biome-ignore-all assist/source/organizeImports: <explanation: Biome> */
/** biome-ignore-all lint/suspicious/noImplicitAnyLet: <explanation: Biome> */
/** biome-ignore-all lint/suspicious/noAssignInExpressions: <explanation: Biome> */
/** biome-ignore-all lint/style/noNonNullAssertion: <explanation: Biome> */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Biome> */
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

/**
 * Handles dependency graph resolution.
 */
export class DependencyTracer {
  // Regex to catch:
  // import x from "path"
  // import "path"
  // export x from "path"
  // require("path")
  private static IMPORT_RE =
    /(?:import|export)(?:.+?from\s+|(?:\s+))['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;

  // Extensions to try when resolving relative paths
  private static EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".json"];

  /**
   * Traces dependencies starting from an entry file.
   * @returns Set of absolute paths including the entry file.
   */
  static async trace(entryFile: string, rootDir: string): Promise<Set<string>> {
    const visited = new Set<string>();
    const queue = [entryFile];

    // Normalize root for containment checks
    const absRoot = resolve(rootDir);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);

      try {
        const content = await readFile(current, "utf-8");
        const imports = this.extractImports(content);

        for (const imp of imports) {
          // Resolve path relative to current file
          const resolved = await this.resolveModule(imp, dirname(current));

          if (resolved) {
            // Security: Only trace files INSIDE the project root
            // and avoid node_modules (unless you want to trace them too, usually no)
            if (
              resolved.startsWith(absRoot) &&
              !resolved.includes("node_modules")
            ) {
              if (!visited.has(resolved)) {
                queue.push(resolved);
              }
            }
          }
        }
      } catch {}
    }

    return visited;
  }

  private static extractImports(content: string): string[] {
    const paths: string[] = [];
    let match;
    // Reset regex index
    this.IMPORT_RE.lastIndex = 0;

    while ((match = this.IMPORT_RE.exec(content)) !== null) {
      // Group 1: import/export, Group 2: require
      const p = match[1] || match[2];
      if (p && (p.startsWith("./") || p.startsWith("../"))) {
        paths.push(p);
      }
      // Note: We skip non-relative imports (packages) like "react"
      // because we only digest local source code.
    }
    return paths;
  }

  /**
   * Tries to find the actual file on disk.
   * Handles:
   * - ./file -> ./file.ts
   * - ./file.js -> ./file.ts (BUN/ESM FIX)
   * - ./dir -> ./dir/index.ts
   */
  private static async resolveModule(
    importPath: string,
    baseDir: string,
  ): Promise<string | null> {
    const fullPath = resolve(baseDir, importPath);

    // 1. Direct match (Ex: import "./data.json" or real .js file)
    if (existsSync(fullPath)) {
      const s = await stat(fullPath);
      if (s.isFile()) return fullPath;
      if (s.isDirectory()) return this.resolveIndex(fullPath);
    }

    // 🔥 FIX UTAMA: Handle import .js tapi aslinya .ts
    // Bun/TS sering import pake .js padahal source-nya .ts
    if (fullPath.endsWith(".js")) {
      const tsPath = fullPath.replace(/\.js$/, ".ts");
      if (existsSync(tsPath)) return tsPath;

      const tsxPath = fullPath.replace(/\.js$/, ".tsx");
      if (existsSync(tsxPath)) return tsxPath;
    }

    // 2. Try extensions (Ex: import "./utils")
    for (const ext of this.EXTS) {
      const withExt = fullPath + ext;
      if (existsSync(withExt)) return withExt;
    }

    // 3. Try directory index (Ex: import "./utils")
    return this.resolveIndex(fullPath);
  }

  private static async resolveIndex(dirPath: string): Promise<string | null> {
    for (const ext of this.EXTS) {
      const indexPath = join(dirPath, `index${ext}`);
      if (existsSync(indexPath)) return indexPath;
    }
    return null;
  }
}

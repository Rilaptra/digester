/** biome-ignore-all lint/complexity/noThisInStatic: <explanation: Biome> */
/** biome-ignore-all assist/source/organizeImports: <explanation: Biome> */
/** biome-ignore-all lint/suspicious/noImplicitAnyLet: <explanation: Biome> */
/** biome-ignore-all lint/suspicious/noAssignInExpressions: <explanation: Biome> */
/** biome-ignore-all lint/style/noNonNullAssertion: <explanation: Biome> */
/** biome-ignore-all lint/complexity/noStaticOnlyClass: <explanation: Biome> */
import { dirname, join, resolve } from "node:path";

/**
 * Handles dependency graph resolution.
 * Optimized for Bun's fast file system access.
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
        const file = Bun.file(current);
        const content = await file.text();
        const imports = this.extractImports(content);

        for (const imp of imports) {
          // Resolve path relative to current file
          const resolved = await this.resolveModule(imp, dirname(current));

          if (resolved) {
            // Security: Only trace files INSIDE the project root
            // and avoid node_modules
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

    // 1. Direct match
    const directFile = Bun.file(fullPath);
    if (await directFile.exists()) {
      return fullPath;
    }

    // 🔥 ESM/Bun Fix: Handle .js imports pointing to .ts/.tsx files
    if (fullPath.endsWith(".js")) {
      const tsPath = fullPath.slice(0, -3) + ".ts";
      if (await Bun.file(tsPath).exists()) return tsPath;

      const tsxPath = fullPath.slice(0, -3) + ".tsx";
      if (await Bun.file(tsxPath).exists()) return tsxPath;
    }

    // 2. Try extensions
    for (const ext of this.EXTS) {
      const withExt = fullPath + ext;
      if (await Bun.file(withExt).exists()) return withExt;
    }

    // 3. Try directory index
    return this.resolveIndex(fullPath);
  }

  private static async resolveIndex(dirPath: string): Promise<string | null> {
    for (const ext of this.EXTS) {
      const indexPath = join(dirPath, `index${ext}`);
      if (await Bun.file(indexPath).exists()) return indexPath;
    }
    return null;
  }
}

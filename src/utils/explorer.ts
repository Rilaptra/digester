// --- src/utils/explorer.ts ---
import { TreeSelect } from "@rilaptra/tui";

export async function promptFileExplorer(
  _startDir: string = process.cwd(),
  rootDir: string = process.cwd(),
  multiSelect: boolean = false,
): Promise<string | string[] | null> {
  const tree = new TreeSelect({
    title: multiSelect
      ? "Select paths (Space: Select, Enter: Confirm):"
      : "Select a file to digest:",
    rootDir: rootDir,
    multiSelect: multiSelect,
  });
  return await tree.run();
}

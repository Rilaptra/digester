import { TreeSelect } from "./tui/TreeSelect.js";

export async function promptFileExplorer(
  _startDir: string = process.cwd(),
  rootDir: string = process.cwd(),
): Promise<string | null> {
  // Pake komponen baru yang keren
  const tree = new TreeSelect({
    title: "Select a file to digest:",
    rootDir: rootDir,
    // startDir logic bisa ditambahin di TreeSelect kalo mau jump to path
  });
  return await tree.run();
}

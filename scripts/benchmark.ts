
import { Scanner } from "../src/core/Scanner";
import { ConfigManager } from "../src/managers/ConfigManager";
import { formatSize } from "../src/utils/formatting";
import chalk from "chalk";

async function runBenchmark() {
  console.log(chalk.bold.cyan("\n🚀 DIGESTER PERFORMANCE BENCHMARK\n"));

  const targetDir = process.cwd();
  const config = await ConfigManager.load(targetDir);

  // Warm up
  await Scanner.run(targetDir, config);

  const iterations = 5;
  let totalDuration = 0;
  let totalFiles = 0;
  let totalSize = 0;

  console.log(chalk.yellow(`Running ${iterations} iterations on ${targetDir}...`));

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const stats = await Scanner.run(targetDir, config);
    const end = performance.now();

    totalDuration += (end - start);
    totalFiles = stats.files.length;
    totalSize = stats.totalSize;

    console.log(`  Iteration ${i + 1}: ${ (end - start).toFixed(2) }ms`);
  }

  const avgDuration = totalDuration / iterations;
  const memoryUsage = process.memoryUsage().heapUsed;

  console.log(chalk.gray("\n----------------------------------------"));
  console.log(`  Total Files   : ${chalk.green(totalFiles)}`);
  console.log(`  Total Size    : ${chalk.green(formatSize(totalSize))}`);
  console.log(`  Avg Duration  : ${chalk.cyan(avgDuration.toFixed(2) + "ms")}`);
  console.log(`  Memory Used   : ${chalk.magenta(formatSize(memoryUsage))}`);
  console.log(chalk.gray("----------------------------------------\n"));
}

runBenchmark().catch(console.error);


import { Scanner } from "../src/core/Scanner.js";
import { ConfigManager } from "../src/managers/ConfigManager.js";
import { formatSize } from "../src/utils/formatting.js";
import chalk from "chalk";

/**
 * Advanced Performance Benchmark for Digester.
 * Measures latency, throughput, and memory efficiency with high precision.
 */
async function runBenchmark() {
  console.log(chalk.bold.cyan("\n🚀 DIGESTER PERFORMANCE BENCHMARK\n"));

  const targetDir = process.cwd();
  const config = await ConfigManager.load(targetDir);

  // 1. Warm-up & Data Validation
  const initialStats = await Scanner.run(targetDir, config);
  const totalFiles = initialStats.files.length;
  const totalSize = initialStats.totalSize;

  const iterations = 10;
  const times: number[] = [];

  console.log(chalk.yellow(`Running ${iterations} iterations on ${chalk.bold(targetDir)}...`));
  console.log(chalk.dim(`Dataset: ${totalFiles} files | ${formatSize(totalSize)}\n`));

  // 2. Execution Loop
  for (let i = 0; i < iterations; i++) {
    // Force GC if possible for cleaner measurement (Bun specific)
    if (global.Bun) Bun.gc(true);

    const start = Bun.nanoseconds();
    await Scanner.run(targetDir, config);
    const end = Bun.nanoseconds();

    const durationMs = Number(end - start) / 1e6;
    times.push(durationMs);

    console.log(`  [${(i + 1).toString().padStart(2, "0")}] ${durationMs.toFixed(3)}ms`);
  }

  // 3. Statistical Analysis
  times.sort((a, b) => a - b);
  const totalDuration = times.reduce((a, b) => a + b, 0);
  const avgDuration = totalDuration / iterations;
  const median = times[Math.floor(iterations / 2)];
  const min = times[0];
  const max = times[times.length - 1];

  const memoryUsage = process.memoryUsage().heapUsed;
  const throughput = (totalSize / 1024 / 1024) / (avgDuration / 1000); // MB/s

  console.log(chalk.gray("\n" + "─".repeat(50)));
  console.log(`${chalk.white("  Metrics".padEnd(15))} : ${chalk.green(totalFiles.toString().padEnd(5))} files | ${chalk.green(formatSize(totalSize))}`);
  console.log(`${chalk.white("  Latency (Avg)".padEnd(15))} : ${chalk.cyan(avgDuration.toFixed(3) + "ms")}`);
  console.log(`${chalk.white("  Latency (Med)".padEnd(15))} : ${chalk.cyan(median.toFixed(3) + "ms")}`);
  console.log(`${chalk.white("  Latency Range".padEnd(15))} : ${chalk.dim(min.toFixed(3) + "ms ... " + max.toFixed(3) + "ms")}`);
  console.log(`${chalk.white("  Throughput".padEnd(15))} : ${chalk.yellow(throughput.toFixed(2) + " MB/s")}`);
  console.log(`${chalk.white("  Memory (Heap)".padEnd(15))} : ${chalk.magenta(formatSize(memoryUsage))}`);
  console.log(chalk.gray("─".repeat(50) + "\n"));
}

runBenchmark().catch(console.error);

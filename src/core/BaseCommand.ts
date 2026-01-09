import Boxen from "boxen";
import chalk from "chalk";
import Table from "cli-table3";
import ora, { type Ora } from "ora";
import * as Utils from "../utils/index.js";
import { generateLog } from "../utils/logger.js";
import type { CommandLoader } from "./CommandLoader.js";

export abstract class BaseCommand {
  public abstract name: string;
  public abstract description: string;
  public aliases: string[] = [];

  /**
   * Main execution method.
   * @param args - Arguments passed after the command name.
   * @param context - Optional context containing the command loader.
   * @returns A promise that resolves when the command finishes execution.
   */
  public abstract execute(
    args: string[],
    context?: { loader: CommandLoader },
  ): Promise<void>;

  protected log(msg: string) {
    generateLog({ type: "info", raw: true }, msg);
  }

  protected error(msg: string) {
    generateLog({ type: "error" }, msg);
  }

  protected success(msg: string) {
    generateLog({ type: "success" }, msg);
  }

  protected warn(msg: string) {
    generateLog({ type: "warn" }, msg);
  }

  protected info(msg: string) {
    generateLog({ type: "info" }, msg);
  }

  protected dim(msg: string) {
    generateLog({ type: "info", noContext: true }, chalk.gray(msg));
  }

  protected spinner(text: string): Ora {
    return ora(text).start();
  }

  protected createBox(text: string, title?: string) {
    generateLog(
      { type: "info", raw: true },
      Boxen(text, {
        padding: 1,
        borderStyle: "round",
        title: title ? chalk.cyan(title) : undefined,
        borderColor: "cyan",
      }),
    );
  }

  protected createTable(headers: string[]) {
    return new Table({
      head: headers.map((h) => chalk.cyan(h)),
      style: { head: [], border: [] },
    });
  }

  protected async promptYesNo(question: string): Promise<boolean> {
    return Utils.promptYesNo(question);
  }

  protected async promptSelect(
    question: string,
    options: string[],
  ): Promise<string> {
    return Utils.promptSelect(question, options);
  }
}

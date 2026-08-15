// --- Confirm.ts ---
import { ANSI, c, type KeyPress, useInput, write } from "./core";

export interface ConfirmConfig {
  title: string;
  initialValue?: boolean;
}

export class Confirm {
  private config: ConfirmConfig;
  private value: boolean;

  constructor(config: ConfirmConfig) {
    this.config = config;
    this.value = config.initialValue ?? false;
  }

  public async run(): Promise<boolean> {
    write(ANSI.HIDE_CURSOR);

    const render = () => {
      write(ANSI.CLEAR_LINE);
      const qMark = c.cyan("? ");
      const title = c.bold(this.config.title);

      const yesLabel = this.value ? c.bgGreen(" Yes ") : c.dim(" Yes ");
      const noLabel = !this.value ? c.bgRed(" No ") : c.dim(" No ");

      write(`${qMark}${title}  ${yesLabel}  ${noLabel}`);
    };

    render();

    return new Promise((resolve) => {
      const cleanup = useInput((key: KeyPress) => {
        if (key.ctrl && key.name === "c") {
          cleanup();
          write(`\n${ANSI.SHOW_CURSOR}`);
          process.exit(0);
        }

        switch (key.name) {
          case "left":
          case "right":
          case "tab":
            this.value = !this.value;
            render();
            break;
          case "y":
            this.value = true;
            render();
            break;
          case "n":
            this.value = false;
            render();
            break;
          case "return": {
            cleanup();
            write(ANSI.CLEAR_LINE);
            const finalRes = this.value ? c.green("Yes") : c.red("No");
            write(`${c.cyan("? ")} ${c.bold(this.config.title)} ${finalRes}\n`);
            write(ANSI.SHOW_CURSOR);
            resolve(this.value);
            break;
          }
        }
      });
    });
  }
}

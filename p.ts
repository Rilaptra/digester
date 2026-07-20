import { emitKeypressEvents } from "node:readline";

const { stdin } = process;
if (stdin.setRawMode) stdin.setRawMode(true);
stdin.resume();
emitKeypressEvents(stdin);

stdin.on("keypress", (_chunk, key) => {
  console.log(key);
  if (key.ctrl && key.name === "c") {
    process.exit(0);
  }
});

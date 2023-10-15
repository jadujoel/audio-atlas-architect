import { watch } from "chokidar";
import { exec } from 'node:child_process'
import { promisify } from "node:sys";

export const run = (cmd: string) => {
  return promisify(exec)(cmd);
}

const watcher = watch("src", {
  ignored: /(^|[\/\\])\../,
  persistent: true,
});

let isBuilding = false
let buildId = 0

const build = async () => {
  console.log(`Build ${++buildId}`);
  isBuilding = true
  await run("bun run build")
  isBuilding = false
  console.log("Watching...")
}

build()
watcher.on("change", async (path) => {
  if (isBuilding || path === "src/protobuf/bank.ts") {
    return
  }
  build()
})

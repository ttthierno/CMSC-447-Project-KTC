import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { root, localDatabase } from "./local-db.mjs";
await fs.access(path.join(root, "server/dist/index.js")).catch(() => {
  throw new Error("Run npm run setup first.");
});
const { pg } = await localDatabase();
const children = [];
let stopping = false;
const stop = async (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  await pg.stop();
  process.exit(code);
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void stop());
for (const [cwd, file, args] of [
  [path.join(root, "server"), "dist/index.js", []],
  [
    path.join(root, "frontend"),
    "node_modules/vite/bin/vite.js",
    ["--host", "127.0.0.1", "--port", "5173", "--strictPort"],
  ],
]) {
  const child = spawn(process.execPath, [file, ...args], {
    cwd,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (!stopping) void stop(code || 1);
  });
}
console.log("KonTraCk demo: http://localhost:5173 — press Ctrl+C to stop.");

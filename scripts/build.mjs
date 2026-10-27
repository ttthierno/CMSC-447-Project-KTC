import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const [dir, script, args] of [
  ["server", "prisma/build/index.js", ["generate"]],
  ["server", "typescript/bin/tsc", []],
  ["frontend", "typescript/bin/tsc", ["-b"]],
  ["frontend", "vite/bin/vite.js", ["build"]],
]) {
  const result = spawnSync(
    process.execPath,
    [path.join(root, dir, "node_modules", script), ...args],
    { cwd: path.join(root, dir), stdio: "inherit", windowsHide: true },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}

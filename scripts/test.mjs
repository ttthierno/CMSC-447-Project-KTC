import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "server/node_modules/tsx/dist/cli.mjs"),
    "--test",
    "tests/integration.test.ts",
    "tests/merge-compatibility.test.ts",
  ],
  { cwd: path.join(root, "server"), stdio: "inherit", windowsHide: true },
);
process.exit(result.status ?? 1);

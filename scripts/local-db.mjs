import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export async function localDatabase(create = false) {
  const dir = path.join(root, ".local");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "database.json");
  let config;
  try {
    config = JSON.parse(await fs.readFile(file, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT" || !create)
      throw new Error("Run npm run setup first.");
    config = {
      port: 55437,
      user: "ktc_owner",
      password: randomBytes(24).toString("hex"),
      authPassword: randomBytes(24).toString("hex"),
      appPassword: randomBytes(24).toString("hex"),
    };
    await fs.writeFile(file, JSON.stringify(config), {
      mode: 0o600,
      flag: "wx",
    });
  }
  const pg = new EmbeddedPostgres({
    ...config,
    databaseDir: path.join(dir, "postgres"),
    authMethod: "scram-sha-256",
    persistent: true,
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: (message) => { if (process.env.KTC_DB_VERBOSE === "true") console.log(message); },
    onError: (error) => console.error(error),
  });
  try {
    await fs.access(path.join(dir, "postgres", "PG_VERSION"));
  } catch {
    if (!create) throw new Error("Run setup first.");
    await pg.initialise();
  }
  try {
    await pg.start();
  } catch (error) {
    throw new Error(`Local PostgreSQL could not start on port ${config.port}. Stop another demo using that port; set KTC_DB_VERBOSE=true for details.`, { cause: error });
  }
  return { pg, config };
}

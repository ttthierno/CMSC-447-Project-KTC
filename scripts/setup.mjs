import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { root, localDatabase } from "./local-db.mjs";
const { pg, config } = await localDatabase(true);
const literal = (s) => "'" + s.replaceAll("'", "''") + "'";
const url = (user, password) =>
  `postgresql://${user}:${password}@127.0.0.1:${config.port}/ktc_demo`;
const run = (file, args, cwd, env) => {
  const p = spawnSync(process.execPath, [file, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit",
    windowsHide: true,
  });
  if (p.status !== 0)
    throw new Error(`Command failed: ${path.basename(file)} ${args.join(" ")}`);
};
let db;
try {
  const sys = pg.getPgClient("postgres");
  await sys.connect();
  if (
    !(await sys.query("SELECT 1 FROM pg_database WHERE datname='ktc_demo'"))
      .rowCount
  )
    await sys.query("CREATE DATABASE ktc_demo");
  for (const [user, password] of [
    ["ktc_auth", config.authPassword],
    ["ktc_runtime", config.appPassword],
  ]) {
    if (
      !(await sys.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [user]))
        .rowCount
    )
      await sys.query(
        `CREATE ROLE ${user} LOGIN PASSWORD ${literal(password)} NOSUPERUSER NOBYPASSRLS`,
      );
  }
  await sys.end();
  db = pg.getPgClient("ktc_demo");
  await db.connect();
  const server = path.join(root, "server");
  const env = { DATABASE_URL: url(config.user, config.password) };
  run(
    path.join(server, "node_modules/prisma/build/index.js"),
    ["generate"],
    server,
    env,
  );
  run(
    path.join(server, "node_modules/prisma/build/index.js"),
    ["migrate", "deploy"],
    server,
    env,
  );
  if (
    !(await db.query("SELECT 1 FROM pg_namespace WHERE nspname='ktc'")).rowCount
  )
    await db.query(
      await fs.readFile(path.join(root, "database/001_schema.sql"), "utf8"),
    );
  for (const [version, file] of [
    [2, "002_access_and_workflows.sql"],
    [3, "003_application_bridge.sql"],
  ])
    if (
      !(
        await db.query("SELECT 1 FROM ktc.schema_migration WHERE version=$1", [
          version,
        ])
      ).rowCount
    )
      await db.query(
        await fs.readFile(path.join(root, "database", file), "utf8"),
      );
  await db.query("GRANT ktc_app TO ktc_runtime");
  await db.query("GRANT USAGE ON SCHEMA public TO ktc_auth");
  await db.query(
    'GRANT SELECT,INSERT,UPDATE,DELETE ON public."User",public.session,public.account,public.verification TO ktc_auth',
  );
  await db.query(
    "GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO ktc_auth",
  );
  const envFile = path.join(root, "server/.env");
  try {
    await fs.access(envFile);
  } catch {
    await fs.writeFile(
      envFile,
      `DATABASE_URL=${url("ktc_auth", config.authPassword)}\nKTC_DATABASE_URL=${url("ktc_runtime", config.appPassword)}\nBETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nBETTER_AUTH_URL=http://localhost:3000\nFRONTEND_URL=http://localhost:5173\nPORT=3000\nDEMO_MODE=true\n`,
      { mode: 0o600, flag: "wx" },
    );
  }
  run(path.join(server, "node_modules/typescript/bin/tsc"), [], server, {});
  run(
    path.join(server, "node_modules/tsx/dist/cli.mjs"),
    ["scripts/seed-demo.ts"],
    server,
    {},
  );
  console.log(
    "Setup complete. Start with npm run demo. Database and file storage persist between runs.",
  );
} finally {
  await db?.end();
  await pg.stop();
}

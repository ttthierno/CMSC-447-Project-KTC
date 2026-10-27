// Run the supplied psql test suite through node-postgres without changing its SQL.
// Its \gset variable is resolved on the same connection and transaction.
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { root } from "./local-db.mjs";
const config = JSON.parse(
  await fs.readFile(path.join(root, ".local/database.json"), "utf8"),
);
const client = new pg.Client({
  host: "127.0.0.1",
  port: config.port,
  user: config.user,
  password: config.password,
  database: "ktc_demo",
});
await client.connect();
try {
  const sql = (
    await fs.readFile(path.join(root, "database/tests/integration.sql"), "utf8")
  ).replace(/^\\(?:set|pset).*\r?\n/gm, "");
  const match = sql.match(
    /^SELECT export_id AS test_export_id[^\r\n]+\\gset\r?$/m,
  );
  if (!match || match.index === undefined)
    throw new Error("Unexpected supplied test format");
  await client.query(sql.slice(0, match.index));
  const { rows } = await client.query(match[0].replace(/\\gset\s*$/, ""));
  if (rows.length !== 1 || !/^[0-9a-f-]{36}$/.test(rows[0].test_export_id))
    throw new Error("Expected one test export");
  const results = await client.query(
    sql
      .slice(match.index + match[0].length)
      .replaceAll(":'test_export_id'", `'${rows[0].test_export_id}'`),
  );
  for (const result of Array.isArray(results) ? results : [results]) {
    if (result.rows?.[0]?.passed_checks)
      console.log(
        `Supplied database suite: ${result.rows[0].passed_checks} checks passed; fixture transaction rolled back.`,
      );
  }
} finally {
  await client.query("ROLLBACK").catch(() => {});
  await client.end();
}

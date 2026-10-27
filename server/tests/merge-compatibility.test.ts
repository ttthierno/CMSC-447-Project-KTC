import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";

const config = JSON.parse(await fs.readFile("../.local/database.json", "utf8"));
const owner = () => new pg.Client({
  host: "127.0.0.1", port: config.port, user: config.user,
  password: config.password, database: "ktc_demo",
});
const base = "http://localhost:3000";
const password = "KonTrack-Merge-Test-2026!";
async function post(route: string, body: unknown, cookie = "") {
  const response = await fetch(base + "/api/auth/" + route, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:5173", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { response, data: await response.json(), cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ") };
}

test("teammate username migration preserves populated pre-username tables", async () => {
  const db = owner();
  await db.connect();
  // A transaction-local schema exercises the exact original migrations without touching public/ktc data.
  const schema = "merge_test_" + randomUUID().replaceAll("-", "");
  try {
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA ${schema}`);
    await db.query(`SET LOCAL search_path TO ${schema}`);
    const migrations = (await fs.readdir("prisma/migrations")).filter(x => /^2026/.test(x)).sort();
    for (const name of migrations.filter(x => x < "20261027083253"))
      await db.query(await fs.readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    await db.query(`INSERT INTO "User" (name,email,"emailVerified") VALUES ('Existing user','legacy@example.test',true),('Second user','second@example.test',true);
      INSERT INTO account ("accountId","providerId","userId",password) VALUES ('1','credential',1,'unchanged-hash');
      INSERT INTO session ("expiresAt",token,"userId") VALUES (NOW()+INTERVAL '1 day','unchanged-session',1);
      INSERT INTO "Project" (name) VALUES ('Legacy project');
      INSERT INTO "ProjectMember" ("projectId","userId",role) VALUES (1,1,'ADMIN');`);
    for (const name of migrations.filter(x => x >= "20261027083253"))
      await db.query(await fs.readFile(`prisma/migrations/${name}/migration.sql`, "utf8"));
    assert.deepEqual((await db.query('SELECT id,username,"displayUsername",email FROM "User" ORDER BY id')).rows, [
      { id: 1, username: "user_1", displayUsername: "Existing user", email: "legacy@example.test" },
      { id: 2, username: "user_2", displayUsername: "Second user", email: "second@example.test" },
    ]);
    assert.equal((await db.query('SELECT password FROM account WHERE "userId"=1')).rows[0].password,"unchanged-hash");
    assert.equal((await db.query('SELECT token FROM session WHERE "userId"=1')).rows[0].token,"unchanged-session");
    assert.equal((await db.query('SELECT role FROM "ProjectMember" WHERE "userId"=1')).rows[0].role,"ADMIN");
    assert.equal((await db.query('SELECT name FROM "Project" WHERE id=1')).rows[0].name,"Legacy project");
    for (const [value, code] of [[null,"23502"],["user_1","23505"]]) {
      await db.query("SAVEPOINT constraint_check");
      await assert.rejects(db.query('INSERT INTO "User" (name,email,username) VALUES ($1,$2,$3)',["Invalid","invalid@example.test",value]),(e: any) => e.code===code);
      await db.query("ROLLBACK TO SAVEPOINT constraint_check");
    }
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
});

test("username signup, uniqueness, profile editing and sign-in remain compatible", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0,16);
  const username = `merge_${suffix}`;
  const email = `${username}@example.test`;
  const duplicateEmail = `dup_${email}`;
  const db = owner();
  await db.connect();
  try {
    const created = await post("sign-up/email",{ name: "Merge Test", email, username, password });
    assert.equal(created.response.status,200,JSON.stringify(created.data));
    assert.equal(created.data.user.username, username);
    const duplicate = await post("sign-up/email",{ name: "Duplicate", email: duplicateEmail, username: username.toUpperCase(), password });
    assert.ok([400,422].includes(duplicate.response.status),JSON.stringify(duplicate.data));
    // Local fixture verification: no real email or external message is sent.
    await db.query('UPDATE "User" SET "emailVerified"=true WHERE email=$1',[email]);
    const loggedIn = await post("sign-in/email",{ email, password });
    assert.equal(loggedIn.response.status,200);
    assert.ok(loggedIn.cookie);
    const updated = await post("update-user",{ name: "Updated Merge Test", username: `${username}_v2` },loggedIn.cookie);
    assert.equal(updated.response.status,200,JSON.stringify(updated.data));
    const row = (await db.query('SELECT name,username FROM "User" WHERE email=$1',[email])).rows[0];
    assert.equal(row.name,"Updated Merge Test");
    assert.equal(row.username,`${username}_v2`);
    const signedInByUsername = await post("sign-in/username",{ username: `${username}_v2`, password });
    assert.equal(signedInByUsername.response.status,200,JSON.stringify(signedInByUsername.data));
  } finally {
    await db.query('DELETE FROM "User" WHERE email=ANY($1::text[])',[[email,duplicateEmail]]);
    await db.end();
  }
});

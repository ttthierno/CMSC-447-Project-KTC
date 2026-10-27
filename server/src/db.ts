import "dotenv/config";
import pg from "pg";
import type { PoolClient } from "pg";
if (!process.env.KTC_DATABASE_URL)
  throw new Error("KTC_DATABASE_URL is required. Run setup.");
export const pool = new pg.Pool({
  connectionString: process.env.KTC_DATABASE_URL,
  max: 10,
});
pool.on("error", (error) =>
  console.error("Idle database connection failed:", error.message),
);
// One client per request; neither role nor identity can leak between transactions.
export async function asActor<T>(
  actor: string,
  action: (db: PoolClient) => Promise<T>,
): Promise<T> {
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL ROLE ktc_app");
    await db.query("SELECT set_config('app.user_id',$1,true)", [actor]);
    const result = await action(db);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function checkRuntimeRole() {
  const {
    rows: [role],
  } = await pool.query(`SELECT rolsuper,rolbypassrls,
    (SELECT nspowner=current_user::regrole FROM pg_namespace WHERE nspname='ktc') AS owns_schema
    FROM pg_roles WHERE rolname=current_user`);
  if (!role || role.rolsuper || role.rolbypassrls || role.owns_schema)
    throw new Error(
      "Business database login must not be a superuser, schema owner, or BYPASSRLS role.",
    );
}

import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import prisma from "../src/prisma.js";
if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production")
  throw new Error("Seeding requires an explicitly local demo.");
const config = JSON.parse(await fs.readFile("../.local/database.json", "utf8"));
const db = new pg.Client({
  host: "127.0.0.1",
  port: config.port,
  user: config.user,
  password: config.password,
  database: "ktc_demo",
});
await db.connect();
const password = "KonTrack-Demo-2026!";
const actors: Record<string, string> = {};
try {
  for (const [key, name] of [
    ["admin", "Demo Administrator"],
    ["inspector", "Demo Inspector"],
    ["reviewer", "Demo Reviewer"],
    ["contractor", "Demo Contractor"],
    ["outsider", "Outside Project User"],
  ]) {
    const email = `${key}@kontrack.demo`;
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: { name, email, username: `demo_${key}`, displayUsername: `demo_${key}`, emailVerified: true },
      });
      await prisma.account.create({
        data: {
          userId: user.id,
          accountId: String(user.id),
          providerId: "credential",
          password: await hashPassword(password),
        },
      });
    }
    actors[key] = (
      await db.query("SELECT ktc.ensure_auth_user($1) AS id", [user.id])
    ).rows[0].id;
  }
  await db.query(
    "UPDATE ktc.app_user SET can_create_projects=true WHERE user_id=$1",
    [actors.admin],
  );
  const fixtures = path.resolve("../demo");
  await fs.mkdir(fixtures, { recursive: true });
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let i = 0; i < 2; i++) {
    const page = pdf.addPage([612, 792]);
    if (i === 1) page.setRotation(degrees(90));
    const blue = rgb(0.07, 0.25, 0.42),
      pale = rgb(0.94, 0.96, 0.97);
    page.drawText("KONTRACK / EXAMPLE PROJECT", {
      x: 40,
      y: 748,
      font: bold,
      size: 18,
      color: blue,
    });
    page.drawText(
      `Synthetic classroom drawing - Page ${i + 1}${i ? " (90 degree rotation)" : ""}`,
      { x: 40, y: 726, font, size: 11, color: blue },
    );
    for (const [x, y, w, h, label] of [
      [55, 420, 210, 230, "ROOM 101"],
      [310, 420, 245, 230, "ROOM 102"],
      [55, 130, 210, 220, "LOBBY"],
      [310, 130, 245, 220, "CORRIDOR"],
    ] as [number, number, number, number, string][]) {
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        borderColor: blue,
        borderWidth: 2,
        color: pale,
      });
      page.drawText(label, {
        x: x + 18,
        y: y + h - 30,
        size: 13,
        font: bold,
        color: blue,
      });
    }
    page.drawLine({
      start: { x: 55, y: 396 },
      end: { x: 555, y: 396 },
      thickness: 1,
      color: blue,
    });
    page.drawCircle({
      x: 153,
      y: 396,
      size: 8,
      borderColor: blue,
      borderWidth: 1,
    });
    page.drawText("Door inspection / saved anchor 0.25, 0.50", {
      x: 177,
      y: 390,
      font,
      size: 10,
      color: blue,
    });
    page.drawText("DEMO FIXTURE - NOT FOR CONSTRUCTION", {
      x: 40,
      y: 60,
      font: bold,
      size: 11,
      color: blue,
    });
  }
  const fixturePath = path.join(fixtures, "Sprint-2-Example-Plan.pdf");
  let bytes: Buffer;
  try {
    bytes = await fs.readFile(fixturePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    bytes = Buffer.from(await pdf.save());
    await fs.writeFile(fixturePath, bytes, { flag: "wx" });
  }
  const original = (
    await db.query(
      "SELECT project_id FROM ktc.project WHERE name='Example project' AND created_by=$1",
      [actors.admin],
    )
  ).rows[0];
  if (!original) {
    await db.query("BEGIN");
    await db.query("SET LOCAL ROLE ktc_app");
    await db.query("SELECT set_config('app.user_id',$1,true)", [actors.admin]);
    const pid = (
      await db.query(
        "SELECT ktc.create_project('Example project','Sprint 2 classroom walkthrough: drawings, persistent markers and controlled access.') AS id",
      )
    ).rows[0].id;
    for (const role of ["inspector", "reviewer", "contractor"])
      await db.query("SELECT ktc.set_project_member($1,$2,$3,true)", [
        pid,
        actors[role],
        role,
      ]);
    const did = randomUUID(),
      ref = `projects/${pid}/drawings/${did}/source.pdf`,
      dest = path.resolve("storage", ref);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, bytes);
    await db.query(
      `INSERT INTO ktc.drawing(drawing_id,project_id,filename,storage_ref,size_bytes,sha256,page_count,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,2,$7)`,
      [
        did,
        pid,
        "Sprint-2-Example-Plan.pdf",
        ref,
        bytes.length,
        createHash("sha256").update(bytes).digest("hex"),
        actors.admin,
      ],
    );
    for (let n = 1; n <= 2; n++)
      await db.query(
        "INSERT INTO ktc.drawing_page(project_id,drawing_id,page_number,width_points,height_points,rotation) VALUES($1,$2,$3,612,792,$4)",
        [pid, did, n, n === 2 ? 90 : 0],
      );
    await db.query(
      `INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description,created_by)
      VALUES($1,$2,1,.25,.50,'Example door inspection','Verify the door closer in the sample workflow.',$3)`,
      [pid, did, actors.admin],
    );
    await db.query("COMMIT");
  }
  console.log(
    "Demo accounts ready: admin / inspector / reviewer / contractor / outsider @kontrack.demo",
  );
} catch (error) {
  await db.query("ROLLBACK");
  throw error;
} finally {
  await db.end();
  await prisma.$disconnect();
}

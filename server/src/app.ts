import "dotenv/config";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { fileTypeFromBuffer } from "file-type";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import type { PoolClient } from "pg";
import prisma from "./prisma.js";
import { auth } from "./auth.js";
import { asActor, pool, checkRuntimeRole } from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3000);
const origins = new Set([
  process.env.FRONTEND_URL || "http://localhost:5173",
  process.env.BETTER_AUTH_URL || "http://localhost:3000",
]);
const storage = path.resolve(
  process.env.STORAGE_DIR ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), "../storage"),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
});
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const uuid = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "Invalid identifier");
  return value;
};
const requiredText = (value: unknown, max: number, name: string): string => {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max)
    throw new HttpError(400, `${name} is required (maximum ${max} characters)`);
  return value.trim();
};
const actor = (res: Response) => res.locals.actor as string;
const digest = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const statusOut = (s: string) =>
  s === "closed" ? "COMPLETED" : s.toUpperCase();
const statusIn = (s: string) =>
  s === "COMPLETED" ? "closed" : s.toLowerCase();
const roleOut = (s: string) =>
  s === "administrator" ? "ADMIN" : s.toUpperCase();
const filePath = (ref: string) => {
  const result = path.resolve(storage, ref);
  if (!result.startsWith(storage + path.sep))
    throw new HttpError(400, "Invalid file reference");
  return result;
};
app.use(cors({ origin: [...origins], credentials: true }));
app.disable("x-powered-by");
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "128kb" }));
app.get("/api/health", async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({
    status: "healthy",
    application: "KonTraCk",
    schema: "ktc",
    demoMode: process.env.DEMO_MODE === "true",
  });
});
// File downloads and business endpoints require a session, not a client actor ID.
app.use("/api", async (req, res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.headers.origin &&
    !origins.has(req.headers.origin)
  )
    throw new HttpError(403, "Untrusted request origin");
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) throw new HttpError(401, "Sign in to continue");
  const result = await prisma.$queryRaw<
    { actor: string }[]
  >`SELECT ktc.ensure_auth_user(${Number(session.user.id)}::integer) AS actor`;
  res.locals.actor = result[0].actor;
  res.locals.user = {
    id: result[0].actor,
    name: session.user.name,
    email: session.user.email,
  };
  next();
});
app.get("/api/me", (_req, res) => res.json(res.locals.user));
async function projectRole(db: PoolClient, pid: string, allowed?: string[]) {
  const {
    rows: [p],
  } = await db.query(
    "SELECT *,ktc.role_in_project(project_id) AS role FROM ktc.project WHERE project_id=$1",
    [pid],
  );
  if (!p) throw new HttpError(404, "Project not found");
  if (allowed && !allowed.includes(p.role))
    throw new HttpError(
      403,
      "This action is not permitted for your project role",
    );
  return p;
}
async function members(db: PoolClient, pid: string) {
  const { rows } = await db.query(
    `SELECT m.project_user_id,m.role,m.is_active,u.user_id,u.display_name,u.email
    FROM ktc.project_user m JOIN ktc.app_user u USING(user_id) WHERE project_id=$1 AND m.is_active ORDER BY joined_at`,
    [pid],
  );
  return rows.map((m) => ({
    id: m.project_user_id,
    role: roleOut(m.role),
    user: { id: m.user_id, name: m.display_name, email: m.email },
  }));
}
async function drawings(db: PoolClient, pid: string) {
  const { rows } = await db.query(
    "SELECT * FROM ktc.drawing WHERE project_id=$1 ORDER BY created_at",
    [pid],
  );
  return rows.map((d) => ({
    id: d.drawing_id,
    name: d.filename,
    projectId: pid,
    pageCount: d.page_count,
    fileUrl: `/api/projects/${pid}/drawings/${d.drawing_id}/file`,
  }));
}
async function items(db: PoolClient, pid: string, itemId?: string) {
  const { rows } = await db.query(
    `SELECT i.*,d.filename FROM ktc.punch_item i JOIN ktc.drawing d USING(project_id,drawing_id)
    WHERE i.project_id=$1 AND ($2::uuid IS NULL OR i.punch_item_id=$2) ORDER BY i.created_at DESC`,
    [pid, itemId || null],
  );
  const team = await members(db, pid);
  const comments = (
    await db.query(
      "SELECT * FROM ktc.comment WHERE project_id=$1 ORDER BY created_at",
      [pid],
    )
  ).rows;
  const photos = (
    await db.query(
      "SELECT * FROM ktc.photo WHERE project_id=$1 ORDER BY created_at DESC",
      [pid],
    )
  ).rows;
  return rows.map((i) => ({
    id: i.punch_item_id,
    title: i.title,
    description: i.description,
    status: statusOut(i.status),
    priority: i.priority,
    projectId: pid,
    drawingId: i.drawing_id,
    pageNumber: i.page_number,
    markerX: Number(i.x_ratio),
    markerY: Number(i.y_ratio),
    version: i.version,
    createdAt: i.created_at,
    updatedAt: i.updated_at,
    drawing: { id: i.drawing_id, name: i.filename },
    assignee: team.find((m) => m.user.id === i.assignee_user_id) || null,
    comments: comments
      .filter((c) => c.punch_item_id === i.punch_item_id)
      .map((c) => ({
        id: c.comment_id,
        content: c.body,
        createdAt: c.created_at,
      })),
    photos: photos
      .filter((p) => p.punch_item_id === i.punch_item_id)
      .map((p) => ({
        id: p.photo_id,
        originalName: p.filename,
        fileUrl: `/api/projects/${pid}/photos/${p.photo_id}/file`,
        createdAt: p.created_at,
      })),
  }));
}
async function project(db: PoolClient, pid: string) {
  const p = await projectRole(db, pid);
  return {
    id: pid,
    name: p.name,
    description: p.description,
    createdAt: p.created_at,
    currentRole: roleOut(p.role),
    drawings: await drawings(db, pid),
    members: await members(db, pid),
    punchItems: await items(db, pid),
  };
}
app.get("/api/projects", async (_req, res) =>
  res.json(
    await asActor(actor(res), async (db) => {
      const { rows } = await db.query(
        "SELECT project_id FROM ktc.project ORDER BY created_at DESC",
      );
      const result = [];
      for (const p of rows) result.push(await project(db, p.project_id));
      return result;
    }),
  ),
);
app.get("/api/projects/:id", async (req, res) =>
  res.json(await asActor(actor(res), (db) => project(db, uuid(req.params.id)))),
);
app.post("/api/projects", async (req, res) => {
  const name = requiredText(req.body.name, 160, "Project name");
  const description =
    typeof req.body.description === "string"
      ? req.body.description.trim()
      : null;
  if (description && description.length > 10000)
    throw new HttpError(400, "Description is too long");
  const data = await asActor(actor(res), async (db) => {
    const {
      rows: [p],
    } = await db.query("SELECT ktc.create_project($1,$2) AS id", [
      name,
      description,
    ]);
    return project(db, p.id);
  });
  res.status(201).json(data);
});
app.get("/api/projects/:id/members", async (req, res) =>
  res.json(
    await asActor(actor(res), async (db) => {
      const pid = uuid(req.params.id);
      await projectRole(db, pid);
      return members(db, pid);
    }),
  ),
);
app.post("/api/projects/:id/members", async (req, res) => {
  const pid = uuid(req.params.id),
    email = requiredText(req.body.email, 254, "Email").toLowerCase();
  const roles: Record<string, string> = {
    ADMIN: "administrator",
    MEMBER: "inspector",
    INSPECTOR: "inspector",
    CONTRACTOR: "contractor",
    REVIEWER: "reviewer",
  };
  const role = roles[String(req.body.role).toUpperCase()];
  if (!role) throw new HttpError(400, "Invalid project role");
  await asActor(actor(res), (db) => projectRole(db, pid, ["administrator"]));
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });
  if (!user?.emailVerified)
    throw new HttpError(
      400,
      "That person must first register and verify their account",
    );
  const [{ uid }] = await prisma.$queryRaw<
    { uid: string }[]
  >`SELECT ktc.ensure_auth_user(${user.id}::integer) AS uid`;
  const result = await asActor(actor(res), async (db) => {
    await db.query("SELECT ktc.set_project_member($1,$2,$3,true)", [
      pid,
      uid,
      role,
    ]);
    return (await members(db, pid)).find((m) => m.user.id === uid);
  });
  res.status(201).json(result);
});
app.get("/api/projects/:id/punch-items", async (req, res) =>
  res.json(
    await asActor(actor(res), async (db) => {
      const pid = uuid(req.params.id);
      await projectRole(db, pid);
      return items(db, pid);
    }),
  ),
);
app.post("/api/projects/:projectId/punch-items", async (req, res) => {
  const pid = uuid(req.params.projectId),
    b = req.body,
    did = uuid(b.drawingId);
  const title = requiredText(b.title, 200, "Title"),
    description = requiredText(b.description, 10000, "Description");
  if (
    !Number.isInteger(b.pageNumber) ||
    b.pageNumber < 1 ||
    ![b.markerX, b.markerY].every(
      (v) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1,
    )
  )
    throw new HttpError(400, "Select a valid page and drawing location first");
  const priority = b.priority || "MEDIUM";
  if (!["LOW", "MEDIUM", "HIGH"].includes(priority))
    throw new HttpError(400, "Invalid priority");
  const data = await asActor(actor(res), async (db) => {
    await projectRole(db, pid, ["administrator", "inspector"]);
    const {
      rows: [r],
    } = await db.query(
      `INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description,priority,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING punch_item_id`,
      [
        pid,
        did,
        b.pageNumber,
        b.markerX,
        b.markerY,
        title,
        description,
        priority,
        actor(res),
      ],
    );
    return (await items(db, pid, r.punch_item_id))[0];
  });
  res.status(201).json(data);
});
app.patch("/api/projects/:projectId/punch-items/:itemId", async (req, res) => {
  const pid = uuid(req.params.projectId),
    iid = uuid(req.params.itemId),
    b = req.body;
  if (!Number.isInteger(b.version) || b.version < 1)
    throw new HttpError(400, "The saved item version is required");
  const allowed = new Set([
    "version",
    "title",
    "description",
    "priority",
    "status",
    "assigneeId",
  ]);
  if (Object.keys(b).some((k) => !allowed.has(k)))
    throw new HttpError(
      400,
      "Drawing anchors and item ownership cannot be edited",
    );
  const data = await asActor(actor(res), async (db) => {
    await projectRole(db, pid, ["administrator", "inspector", "contractor"]);
    const {
      rows: [old],
    } = await db.query(
      "SELECT * FROM ktc.punch_item WHERE project_id=$1 AND punch_item_id=$2 FOR UPDATE",
      [pid, iid],
    );
    if (!old) throw new HttpError(404, "Punch item not found");
    if (old.version !== b.version)
      throw new HttpError(
        409,
        "This item changed in another session. Reload it before saving.",
      );
    const columns: string[] = [],
      values: unknown[] = [];
    const set = (k: string, v: unknown) => {
      values.push(v);
      columns.push(`${k}=$${values.length}`);
    };
    if ("title" in b) set("title", requiredText(b.title, 200, "Title"));
    if ("description" in b)
      set("description", requiredText(b.description, 10000, "Description"));
    if ("priority" in b) {
      if (!["LOW", "MEDIUM", "HIGH"].includes(b.priority))
        throw new HttpError(400, "Invalid priority");
      set("priority", b.priority);
    }
    if ("status" in b) {
      if (
        !["OPEN", "IN_PROGRESS", "READY_FOR_REVIEW", "COMPLETED"].includes(
          b.status,
        )
      )
        throw new HttpError(400, "Invalid status");
      set("status", statusIn(b.status));
    }
    if ("assigneeId" in b) {
      let uid = null;
      if (b.assigneeId !== null) {
        const {
          rows: [m],
        } = await db.query(
          "SELECT user_id FROM ktc.project_user WHERE project_id=$1 AND project_user_id=$2 AND is_active",
          [pid, uuid(b.assigneeId)],
        );
        if (!m)
          throw new HttpError(400, "Assignee must be an active project member");
        uid = m.user_id;
      }
      set("assignee_user_id", uid);
    }
    if (!columns.length)
      throw new HttpError(400, "No editable fields provided");
    values.push(pid, iid, b.version);
    await db.query(
      `UPDATE ktc.punch_item SET ${columns.join(",")} WHERE project_id=$${values.length - 2} AND punch_item_id=$${values.length - 1} AND version=$${values.length}`,
      values,
    );
    return (await items(db, pid, iid))[0];
  });
  res.json(data);
});
const permitUpload = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  await asActor(actor(res), (db) =>
    projectRole(db, uuid(req.params.projectId), ["administrator"]),
  );
  next();
};
app.post(
  "/api/projects/:projectId/drawings",
  permitUpload,
  upload.single("file"),
  async (req, res) => {
    const pid = uuid(req.params.projectId),
      file = req.file;
    if (!file) throw new HttpError(400, "Choose a PDF file");
    if (
      file.mimetype !== "application/pdf" ||
      path.extname(file.originalname).toLowerCase() !== ".pdf" ||
      file.buffer.subarray(0, 5).toString() !== "%PDF-"
    )
      throw new HttpError(400, "Upload a valid PDF");
    let pdf: PDFDocument;
    try {
      pdf = await PDFDocument.load(file.buffer, { ignoreEncryption: false });
    } catch {
      throw new HttpError(400, "The PDF is damaged or encrypted");
    }
    const pages = pdf.getPages();
    if (!pages.length || pages.length > 2000)
      throw new HttpError(400, "PDF must contain 1–2000 pages");
    const did = randomUUID(),
      ref = `projects/${pid}/drawings/${did}/source.pdf`,
      dest = filePath(ref);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.buffer, { flag: "wx" });
    try {
      const data = await asActor(actor(res), async (db) => {
        await projectRole(db, pid, ["administrator"]);
        await db.query(
          `INSERT INTO ktc.drawing(drawing_id,project_id,filename,storage_ref,size_bytes,sha256,page_count,uploaded_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            did,
            pid,
            path.basename(file.originalname).slice(0, 255),
            ref,
            file.size,
            digest(file.buffer),
            pages.length,
            actor(res),
          ],
        );
        for (let n = 0; n < pages.length; n++) {
          const crop = pages[n].getCropBox();
          const rotation = ((pages[n].getRotation().angle % 360) + 360) % 360;
          await db.query(
            "INSERT INTO ktc.drawing_page(project_id,drawing_id,page_number,width_points,height_points,rotation) VALUES($1,$2,$3,$4,$5,$6)",
            [pid, did, n + 1, crop.width, crop.height, rotation],
          );
        }
        return (await drawings(db, pid)).find((d) => d.id === did);
      });
      res.status(201).json(data);
    } catch (error) {
      await fs.unlink(dest).catch(() => {});
      throw error;
    }
  },
);
app.get(
  "/api/projects/:projectId/drawings/:drawingId/file",
  async (req, res) => {
    const pid = uuid(req.params.projectId),
      did = uuid(req.params.drawingId);
    const row = await asActor(actor(res), async (db) => {
      await projectRole(db, pid);
      return (
        await db.query(
          "SELECT storage_ref,filename FROM ktc.drawing WHERE project_id=$1 AND drawing_id=$2",
          [pid, did],
        )
      ).rows[0];
    });
    if (!row) throw new HttpError(404, "Drawing not found");
    res.type("application/pdf");
    res.set("Cache-Control", "private, no-store");
    res.sendFile(filePath(row.storage_ref));
  },
);
app.post(
  "/api/projects/:projectId/punch-items/:itemId/comments",
  async (req, res) => {
    const pid = uuid(req.params.projectId),
      iid = uuid(req.params.itemId),
      body = requiredText(req.body.content, 10000, "Comment");
    const row = await asActor(actor(res), async (db) => {
      await projectRole(db, pid);
      return (
        await db.query(
          "INSERT INTO ktc.comment(project_id,punch_item_id,author_user_id,body) VALUES($1,$2,$3,$4) RETURNING *",
          [pid, iid, actor(res), body],
        )
      ).rows[0];
    });
    res
      .status(201)
      .json({
        id: row.comment_id,
        content: row.body,
        createdAt: row.created_at,
      });
  },
);
app.post(
  "/api/projects/:projectId/punch-items/:itemId/photos",
  async (req, res, next) => {
    await asActor(actor(res), async (db) => {
      const pid = uuid(req.params.projectId);
      await projectRole(db, pid);
      const {
        rows: [r],
      } = await db.query("SELECT ktc.can_add_evidence($1,$2) AS ok", [
        pid,
        uuid(req.params.itemId),
      ]);
      if (!r.ok) throw new HttpError(403, "Photo upload is not permitted");
    });
    next();
  },
  upload.single("file"),
  async (req, res) => {
    const pid = uuid(req.params.projectId),
      iid = uuid(req.params.itemId),
      file = req.file;
    if (!file || file.size > 10 * 1024 * 1024)
      throw new HttpError(400, "Choose an image no larger than 10 MB");
    const type = await fileTypeFromBuffer(file.buffer);
    if (!type || !["image/png", "image/jpeg", "image/webp"].includes(type.mime))
      throw new HttpError(400, "Choose a PNG, JPEG or WebP image");
    const id = randomUUID(),
      ref = `projects/${pid}/photos/${id}/original`,
      dest = filePath(ref);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, file.buffer, { flag: "wx" });
    try {
      const row = await asActor(
        actor(res),
        async (db) =>
          (
            await db.query(
              `INSERT INTO ktc.photo(photo_id,project_id,punch_item_id,uploaded_by,filename,storage_ref,content_type,size_bytes,sha256)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
              [
                id,
                pid,
                iid,
                actor(res),
                path.basename(file.originalname).slice(0, 255),
                ref,
                type.mime,
                file.size,
                digest(file.buffer),
              ],
            )
          ).rows[0],
      );
      res
        .status(201)
        .json({
          id,
          originalName: row.filename,
          fileUrl: `/api/projects/${pid}/photos/${id}/file`,
          createdAt: row.created_at,
        });
    } catch (error) {
      await fs.unlink(dest).catch(() => {});
      throw error;
    }
  },
);
app.get("/api/projects/:projectId/photos/:photoId/file", async (req, res) => {
  const pid = uuid(req.params.projectId),
    id = uuid(req.params.photoId);
  const row = await asActor(actor(res), async (db) => {
    await projectRole(db, pid);
    return (
      await db.query(
        "SELECT storage_ref,content_type FROM ktc.photo WHERE project_id=$1 AND photo_id=$2",
        [pid, id],
      )
    ).rows[0];
  });
  if (!row) throw new HttpError(404, "Photo not found");
  res
    .type(row.content_type)
    .set("Cache-Control", "private, no-store")
    .set("X-Content-Type-Options", "nosniff")
    .sendFile(filePath(row.storage_ref));
});
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
  const code = error.code || error.meta?.code;
  const status =
    error instanceof HttpError
      ? error.status
      : code === "LIMIT_FILE_SIZE"
        ? 413
        : code === "42501"
          ? 403
          : code === "23503" || code === "23514" || code === "22P02"
            ? 400
            : code === "23505"
              ? 409
              : 500;
  if (status === 500) console.error(error);
  const message =
    error instanceof HttpError
      ? error.message
      : status === 413
        ? "File exceeds the upload size limit"
        : status === 403
          ? "This action is not permitted for your project role"
          : status === 400
            ? "Invalid data, drawing page, assignment, or status transition"
            : status === 409
              ? "This record already exists"
              : "Unable to complete this request";
  res.status(status).json({ error: message });
});
await checkRuntimeRole();
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`KonTraCk API: http://localhost:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(async () => {
      await pool.end();
      await prisma.$disconnect();
      process.exit(0);
    }),
  );

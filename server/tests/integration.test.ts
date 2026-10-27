import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import {
  anchorToDisplay,
  displayToAnchor,
} from "../../frontend/src/anchors.ts";
const base = "http://localhost:3000";
const origin = "http://localhost:5173";
const password = "KonTrack-Demo-2026!";
async function login(name: string) {
  const r = await fetch(base + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: `${name}@kontrack.demo`, password }),
  });
  assert.equal(r.status, 200, await r.clone().text());
  return r.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}
async function request(
  url: string,
  cookie = "",
  method = "GET",
  body?: unknown,
) {
  const isForm = body instanceof FormData;
  const r = await fetch(base + url, {
    method,
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(body && !isForm ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  const data = await r.json();
  return { status: r.status, data };
}
const pdf = await fs.readFile("../demo/Sprint-2-Example-Plan.pdf");
function fileForm(
  bytes: Uint8Array = pdf,
  name = "test.pdf",
  type = "application/pdf",
) {
  const f = new FormData();
  f.append("file", new Blob([bytes as BlobPart], { type }), name);
  return f;
}
test("CropBox anchor round-trips for every supported PDF rotation", () => {
  for (const angle of [0, 90, 180, 270])
    for (const [x, y] of [
      [0, 0],
      [1, 1],
      [0.25, 0.5],
      [0.12345678, 0.87654321],
    ]) {
      const [dx, dy] = anchorToDisplay(x, y, angle);
      const [ax, ay] = displayToAnchor(dx, dy, angle);
      assert.ok(Math.abs(ax - x) < 1e-10 && Math.abs(ay - y) < 1e-10);
    }
});
test("Sprint 2 API, persistence, access and edit-conflict integration", async (t) => {
  let pid = "";
  let drawing: any, item: any;
  const admin = await login("admin"),
    inspector = await login("inspector"),
    reviewer = await login("reviewer"),
    outsider = await login("outsider");
  const prefix = () => `/api/projects/${pid}`;
  try {
    await t.test("anonymous project access returns 401", async () =>
      assert.equal((await request("/api/projects")).status, 401),
    );
    await t.test(
      "project creation adds the creator as administrator",
      async () => {
        const r = await request("/api/projects", admin, "POST", {
          name: `Integration test ${Date.now()}`,
        });
        assert.equal(r.status, 201);
        pid = r.data.id;
        assert.equal(r.data.currentRole, "ADMIN");
        assert.equal(r.data.members.length, 1);
      },
    );
    await t.test(
      "verified project members receive explicit roles",
      async () => {
        for (const [name, role] of [
          ["inspector", "INSPECTOR"],
          ["reviewer", "REVIEWER"],
        ])
          assert.equal(
            (
              await request(prefix() + "/members", admin, "POST", {
                email: `${name}@kontrack.demo`,
                role,
              })
            ).status,
            201,
          );
      },
    );
    await t.test("outsider cannot read project or members", async () => {
      assert.equal((await request(prefix(), outsider)).status, 404);
      assert.equal(
        (await request(prefix() + "/members", outsider)).status,
        404,
      );
    });
    await t.test("inspector cannot upload drawings", async () =>
      assert.equal(
        (await request(prefix() + "/drawings", inspector, "POST", fileForm()))
          .status,
        403,
      ),
    );
    await t.test("malformed and spoofed PDF files are rejected", async () => {
      assert.equal(
        (
          await request(
            prefix() + "/drawings",
            admin,
            "POST",
            fileForm(Buffer.from("not a PDF")),
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            prefix() + "/drawings",
            admin,
            "POST",
            fileForm(Buffer.from("%PDF-invalid")),
          )
        ).status,
        400,
      );
    });
    await t.test("administrator uploads parsed two-page PDF", async () => {
      const r = await request(
        prefix() + "/drawings",
        admin,
        "POST",
        fileForm(),
      );
      assert.equal(r.status, 201, JSON.stringify(r.data));
      drawing = r.data;
      assert.equal(drawing.pageCount, 2);
    });
    await t.test(
      "PDF bytes are protected and retrievable without alteration",
      async () => {
        assert.equal((await fetch(base + drawing.fileUrl)).status, 401);
        assert.equal((await request(drawing.fileUrl, outsider)).status, 404);
        const r = await fetch(base + drawing.fileUrl, {
          headers: { Cookie: admin },
        });
        assert.equal(r.status, 200);
        assert.deepEqual(Buffer.from(await r.arrayBuffer()), pdf);
      },
    );
    const body = () => ({
      title: "Marker test",
      description: "Verify the door closer",
      priority: "MEDIUM",
      drawingId: drawing.id,
      pageNumber: 1,
      markerX: 0.25,
      markerY: 0.5,
    });
    await t.test("reviewer cannot create an item", async () =>
      assert.equal(
        (await request(prefix() + "/punch-items", reviewer, "POST", body()))
          .status,
        403,
      ),
    );
    await t.test(
      "invalid coordinates, blank descriptions, and missing PDF pages are rejected",
      async () => {
        for (const change of [
          { markerX: 1.2 },
          { markerY: null },
          { description: "  " },
          { pageNumber: 3 },
        ])
          assert.equal(
            (
              await request(prefix() + "/punch-items", admin, "POST", {
                ...body(),
                ...change,
              })
            ).status,
            400,
          );
      },
    );
    await t.test("cross-project drawing references are rejected", async () => {
      const all = await request("/api/projects", admin);
      const other = all.data.find(
        (p: any) => p.id !== pid && p.drawings.length,
      );
      assert.ok(other);
      assert.equal(
        (
          await request(prefix() + "/punch-items", admin, "POST", {
            ...body(),
            drawingId: other.drawings[0].id,
          })
        ).status,
        400,
      );
    });
    await t.test(
      "inspector creates a persistent item at a normalized anchor",
      async () => {
        const r = await request(
          prefix() + "/punch-items",
          inspector,
          "POST",
          body(),
        );
        assert.equal(r.status, 201, JSON.stringify(r.data));
        item = r.data;
        assert.equal(item.version, 1);
        const read = await request(prefix() + "/punch-items", admin);
        assert.equal(read.data[0].markerX, 0.25);
        assert.equal(read.data[0].markerY, 0.5);
      },
    );
    const itemUrl = () => prefix() + "/punch-items/" + item.id;
    await t.test(
      "edit requires version and cannot change the anchor",
      async () => {
        assert.equal(
          (await request(itemUrl(), admin, "PATCH", { description: "change" }))
            .status,
          400,
        );
        assert.equal(
          (
            await request(itemUrl(), admin, "PATCH", {
              version: item.version,
              markerX: 0.8,
            })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "description edit increments version and preserves anchor",
      async () => {
        const r = await request(itemUrl(), admin, "PATCH", {
          version: item.version,
          title: "Revised door inspection",
          description: "Check the closing force",
        });
        assert.equal(r.status, 200);
        assert.equal(r.data.version, 2);
        assert.equal(r.data.markerX, 0.25);
        assert.equal(r.data.markerY, 0.5);
        item = r.data;
      },
    );
    await t.test("stale edits return 409", async () =>
      assert.equal(
        (
          await request(itemUrl(), admin, "PATCH", {
            version: 1,
            description: "stale",
          })
        ).status,
        409,
      ),
    );
    await t.test(
      "simultaneous edits produce one success and one conflict",
      async () => {
        const rs = await Promise.all(
          ["A", "B"].map((s) =>
            request(itemUrl(), admin, "PATCH", {
              version: item.version,
              description: "Concurrent " + s,
            }),
          ),
        );
        assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
        item = rs.find((r) => r.status === 200)!.data;
      },
    );
    await t.test(
      "workflow rejects skipping review and allows valid transitions",
      async () => {
        assert.equal(
          (
            await request(itemUrl(), admin, "PATCH", {
              version: item.version,
              status: "COMPLETED",
            })
          ).status,
          400,
        );
        for (const status of [
          "IN_PROGRESS",
          "READY_FOR_REVIEW",
          "COMPLETED",
          "OPEN",
        ]) {
          const r = await request(itemUrl(), admin, "PATCH", {
            version: item.version,
            status,
          });
          assert.equal(r.status, 200, JSON.stringify(r.data));
          item = r.data;
        }
      },
    );
    await t.test("existing comment feature remains persistent", async () => {
      const r = await request(itemUrl() + "/comments", inspector, "POST", {
        content: "Inspection completed for demonstration.",
      });
      assert.equal(r.status, 201);
      const read = await request(prefix() + "/punch-items", admin);
      assert.equal(read.data[0].comments.length, 1);
    });
    await t.test(
      "row-level security hides data even outside the API",
      async () => {
        const c = JSON.parse(
          await fs.readFile("../.local/database.json", "utf8"),
        );
        const client = new pg.Client({
          host: "127.0.0.1",
          port: c.port,
          user: "ktc_runtime",
          password: c.appPassword,
          database: "ktc_demo",
        });
        await client.connect();
        try {
          assert.equal(
            (await client.query("SELECT * FROM ktc.project")).rowCount,
            0,
          );
          assert.equal(
            (
              await client.query(
                "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
              )
            ).rows[0].rolsuper,
            false,
          );
        } finally {
          await client.end();
        }
      },
    );
    await t.test("sign-out invalidates the session", async () => {
      assert.equal(
        (await request("/api/auth/sign-out", outsider, "POST", {})).status,
        200,
      );
      assert.equal((await request("/api/projects", outsider)).status, 401);
    });
  } finally {
    if (pid) {
      // Remove only this suite's newly created project and its generated files.
      const c = JSON.parse(
        await fs.readFile("../.local/database.json", "utf8"),
      );
      const db = new pg.Client({
        host: "127.0.0.1",
        port: c.port,
        user: c.user,
        password: c.password,
        database: "ktc_demo",
      });
      await db.connect();
      try {
        await db.query("BEGIN");
        for (const table of [
          "punch_item_event",
          "comment",
          "photo",
          "markup",
          "export_job",
          "punch_item",
          "drawing_page",
          "drawing",
          "project_user",
          "project",
        ])
          await db.query(`DELETE FROM ktc.${table} WHERE project_id=$1`, [pid]);
        await db.query("COMMIT");
      } finally {
        await db.end();
      }
      const target = path.resolve("storage/projects", pid);
      if (path.dirname(target) === path.resolve("storage/projects"))
        await fs.rm(target, { recursive: true, force: true });
    }
  }
});

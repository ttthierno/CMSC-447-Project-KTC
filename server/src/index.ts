

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./prisma.js";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./auth.js";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
  ],
  credentials: true,
}));

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());


const currentFile = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFile);

const uploadsDirectory = path.resolve(
  currentDirectory,
  "../uploads"
);

const drawingsDirectory = path.join(
  uploadsDirectory,
  "drawings"
);


const photosDirectory = path.join(uploadsDirectory, "photos");

fs.mkdirSync(photosDirectory, { recursive: true });

const photoStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, photosDirectory);
  },

  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  },
});

const uploadPhoto = multer({
  storage: photoStorage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
    };

    const extension = path.extname(file.originalname).toLowerCase();

    if (allowedTypes[extension] !== file.mimetype) {
      callback(
        new Error("Only JPG, PNG, and WebP images are allowed.")
      );
      return;
    }

    callback(null, true);
  },
});


fs.mkdirSync(drawingsDirectory, { recursive: true });

app.use("/uploads", express.static(uploadsDirectory));

const drawingStorage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, drawingsDirectory);
  },

  filename: (_req, _file, callback) => {
    callback(null, `${randomUUID()}.pdf`);
  },
});

const uploadDrawing = multer({
  storage: drawingStorage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const isPdf =
      file.mimetype === "application/pdf" &&
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPdf) {
      callback(new Error("Only PDF files are allowed."));
      return;
    }

    callback(null, true);
  },
});


app.get("/", (req, res) => {
  res.json({
    message: "KonTraCk backend is running!",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    application: "KonTraCk",
  });
});

// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        drawings: true,
        members: {
          include: {
            user: true,
          },
        },
        punchItems: true,
      },
    });

    res.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Get one project with its drawings, team, and punch items
app.get("/api/projects/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        drawings: true,
        members: {
          include: {
            user: true,
          },
        },
        punchItems: {
          include: {
            drawing: true,
            assignee: {
              include: {
                user: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// Create a project
app.post("/api/projects", async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        description:
          typeof description === "string" ? description.trim() : null,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    console.error("Failed to create project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Get members for one project
app.get("/api/projects/:id/members", async (req, res) => {
  const projectId = Number(req.params.id);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    res.json(members);
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
});


app.post("/api/projects/:id/members", async (req, res) => {
  const projectId = Number(req.params.id);
  const { name, email, role } = req.body;

  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    res.status(400).json({
      error: "A valid name and email are required",
    });
    return;
  }

  const memberRole =
    typeof role === "string" ? role.toUpperCase() : "MEMBER";

  if (!["ADMIN", "MEMBER"].includes(memberRole)) {
    res.status(400).json({
      error: "Role must be ADMIN or MEMBER",
    });
    return;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const user = await prisma.user.upsert({
      where: { email: email.trim().toLowerCase() },
      update: { name: name.trim() },
      create: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
      },
    });

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
        role: memberRole,
      },
      include: { user: true },
    });

    res.status(201).json(member);
  } catch (error) {
    if (
      typeof
       error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      res.status(409).json({
        error: "This person is already on this project's team",
      });
      return;
    }

    console.error("Failed to add team member:", error);
    res.status(500).json({ error: "Failed to add team member" });
  }
});



app.get("/api/projects/:id/punch-items", async (req, res) => {
  const projectId = Number(req.params.id);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const punchItems = await prisma.punchItem.findMany({
      where: { projectId },
    
include: {
  drawing: true,
  assignee: {
    include: {
      user: true,
    },
  },
  comments: {
    orderBy: {
      createdAt: "asc",
    },
  },
  photos: {
    orderBy: {
      createdAt: "desc",
    },
  },
},

      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(punchItems);
  } catch (error) {
    console.error("Failed to fetch punch items:", error);
    res.status(500).json({ error: "Failed to fetch punch items" });
  }
});


app.post("/api/projects/:projectId/punch-items", async (req, res) => {
  const projectId = Number(req.params.projectId);

  const {
    title,
    description,
    priority,
    drawingId,
    markerX,
    markerY,
    pageNumber,
  } = req.body;

  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Invalid project ID" });
    return;
  }

  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Punch item title is required" });
    return;
  }

  const itemPriority =
    typeof priority === "string" ? priority.toUpperCase() : "MEDIUM";

  if (!["LOW", "MEDIUM", "HIGH"].includes(itemPriority)) {
    res.status(400).json({
      error: "Priority must be LOW, MEDIUM, or HIGH",
    });
    return;
  }

  const hasX = markerX !== undefined && markerX !== null;
  const hasY = markerY !== undefined && markerY !== null;
  const hasPage = pageNumber !== undefined && pageNumber !== null;
  const hasDrawing = drawingId !== undefined && drawingId !== null;

  if (hasX !== hasY) {
    res.status(400).json({
      error: "Both marker coordinates must be provided together",
    });
    return;
  }

  if (
    hasX &&
    (
      typeof markerX !== "number" ||
      typeof markerY !== "number" ||
      !Number.isFinite(markerX) ||
      !Number.isFinite(markerY) ||
      markerX < 0 || markerX > 1 ||
      markerY < 0 || markerY > 1
    )
  ) {
    res.status(400).json({
      error: "Marker coordinates must be between 0 and 1",
    });
    return;
  }

  if (hasX && (!hasDrawing || !hasPage)) {
    res.status(400).json({
      error: "A drawing and page number are required for a marker",
    });
    return;
  }

  if (
    hasPage &&
    (!Number.isInteger(pageNumber) || pageNumber < 1)
  ) {
    res.status(400).json({ error: "Invalid drawing page number" });
    return;
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    let validDrawingId: number | null = null;

    if (hasDrawing) {
      validDrawingId = Number(drawingId);

      if (!Number.isInteger(validDrawingId) || validDrawingId <= 0) {
        res.status(400).json({ error: "Invalid drawing ID" });
        return;
      }

      const drawing = await prisma.drawing.findFirst({
        where: {
          id: validDrawingId,
          projectId,
        },
      });

      if (!drawing) {
        res.status(400).json({
          error: "Drawing does not belong to this project",
        });
        return;
      }
    }

    const punchItem = await prisma.punchItem.create({
      data: {
        title: title.trim(),
        description:
          typeof description === "string"
            ? description.trim() || null
            : null,
        priority: itemPriority,
        projectId,
        drawingId: validDrawingId,
        markerX: hasX ? markerX : null,
        markerY: hasY ? markerY : null,
        pageNumber: hasPage ? pageNumber : null,
      },
      include: {
        drawing: true,
        assignee: {
          include: {
            user: true,
          },
        },
      },
    });

    res.status(201).json(punchItem);
  } catch (error) {
    console.error("Failed to create punch item:", error);
    res.status(500).json({ error: "Failed to create punch item" });
  }
});


app.patch(
  "/api/projects/:projectId/punch-items/:itemId",
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const itemId = Number(req.params.itemId);
    const { status, assigneeId } = req.body;

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      res.status(400).json({ error: "Invalid project or punch item ID" });
      return;
    }

    const hasStatus = Object.prototype.hasOwnProperty.call(
      req.body,
      "status"
    );
    const hasAssignee = Object.prototype.hasOwnProperty.call(
      req.body,
      "assigneeId"
    );

    if (!hasStatus && !hasAssignee) {
      res.status(400).json({
        error: "Provide a status or assigneeId to update",
      });
      return;
    }

    const data: {
      status?: string;
      assigneeId?: number | null;
    } = {};

    if (hasStatus) {
      if (typeof status !== "string") {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      const normalizedStatus = status.toUpperCase();

      if (!["OPEN", "IN_PROGRESS", "COMPLETED"].includes(normalizedStatus)) {
        res.status(400).json({ error: "Invalid status" });
        return;
      }

      data.status = normalizedStatus;
    }

    try {
      const existingItem = await prisma.punchItem.findFirst({
        where: { id: itemId, projectId },
      });

      if (!existingItem) {
        res.status(404).json({ error: "Punch item not found" });
        return;
      }

      if (hasAssignee) {
        if (assigneeId === null) {
          data.assigneeId = null;
        } else {
          const memberId = Number(assigneeId);

          if (!Number.isInteger(memberId) || memberId <= 0) {
            res.status(400).json({ error: "Invalid team member" });
            return;
          }

          const member = await prisma.projectMember.findFirst({
            where: {
              id: memberId,
              projectId,
            },
          });

          if (!member) {
            res.status(400).json({
              error: "This person is not a member of this project",
            });
            return;
          }

          data.assigneeId = memberId;
        }
      }

      const updatedItem = await prisma.punchItem.update({
        where: { id: itemId },
        data,
        include: {
          drawing: true,
          assignee: { include: { user: true } },
        },
      });

      res.json(updatedItem);
    } catch (error) {
      console.error("Failed to update punch item:", error);
      res.status(500).json({ error: "Failed to update punch item" });
    }
  }
);




app.post(
  "/api/projects/:projectId/drawings",
  uploadDrawing.single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const file = req.file;

    if (!Number.isInteger(projectId) || projectId <= 0) {
      if (file) {
        await fs.promises.unlink(file.path).catch(() => {});
      }

      res.status(400).json({ error: "Invalid project ID" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "A PDF file is required" });
      return;
    }

    try {
      // Verify the PDF signature, not just its filename or MIME type.
      const handle = await fs.promises.open(file.path, "r");
      const signature = Buffer.alloc(5);

      try {
        await handle.read(signature, 0, 5, 0);
      } finally {
        await handle.close();
      }

      if (signature.toString("ascii") !== "%PDF-") {
        await fs.promises.unlink(file.path).catch(() => {});
        res.status(400).json({ error: "The uploaded file is not a valid PDF" });
        return;
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
      });

      if (!project) {
        await fs.promises.unlink(file.path).catch(() => {});
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const suppliedName =
        typeof req.body.name === "string" ? req.body.name.trim() : "";

      const drawing = await prisma.drawing.create({
        data: {
          name: suppliedName || path.parse(file.originalname).name,
          fileUrl: `/uploads/drawings/${file.filename}`,
          projectId,
        },
      });

      res.status(201).json(drawing);
    } catch (error) {
      await fs.promises.unlink(file.path).catch(() => {});
      console.error("Failed to upload drawing:", error);
      res.status(500).json({ error: "Failed to upload drawing" });
    }
  }
);



app.post(
  "/api/projects/:projectId/punch-items/:itemId/comments",
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const itemId = Number(req.params.itemId);
    const { content } = req.body;

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      res.status(400).json({ error: "Invalid project or punch item ID" });
      return;
    }

    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Comment cannot be empty" });
      return;
    }

    try {
      const item = await prisma.punchItem.findFirst({
        where: { id: itemId, projectId },
      });

      if (!item) {
        res.status(404).json({ error: "Punch item not found" });
        return;
      }

      const comment = await prisma.punchItemComment.create({
        data: {
          content: content.trim(),
          punchItemId: itemId,
        },
      });

      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to save comment:", error);
      res.status(500).json({ error: "Failed to save comment" });
    }
  }
);


app.post(
  "/api/projects/:projectId/punch-items/:itemId/photos",
  uploadPhoto.single("file"),
  async (req, res) => {
    const projectId = Number(req.params.projectId);
    const itemId = Number(req.params.itemId);
    const file = req.file;

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0 ||
      !Number.isInteger(itemId) ||
      itemId <= 0
    ) {
      if (file) {
        await fs.promises.unlink(file.path).catch(() => {});
      }

      res.status(400).json({ error: "Invalid project or punch item ID" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "A photo file is required" });
      return;
    }

    try {
      const item = await prisma.punchItem.findFirst({
        where: { id: itemId, projectId },
      });

      if (!item) {
        await fs.promises.unlink(file.path).catch(() => {});
        res.status(404).json({ error: "Punch item not found" });
        return;
      }

      const photo = await prisma.punchItemPhoto.create({
        data: {
          fileUrl: `/uploads/photos/${file.filename}`,
          originalName: path.basename(file.originalname),
          punchItemId: itemId,
        },
      });

      res.status(201).json(photo);
    } catch (error) {
      await fs.promises.unlink(file.path).catch(() => {});
      console.error("Failed to upload photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  }
);


// Start the server
app.listen(PORT, () => {
  console.log(`KonTraCk backend running on port ${PORT}`);
});

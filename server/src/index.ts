
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./prisma.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
        punchItems: true,
      },
    });

    res.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
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

// Start the server
app.listen(PORT, () => {
  console.log(`KonTraCk backend running on port ${PORT}`);
});

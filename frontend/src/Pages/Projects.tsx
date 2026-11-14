import { apiFetch } from "../api";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Project = {
  id: string;
  name: string;
  description: string | null;
  currentRole: string;
  drawings: { id: string }[];
  punchItems: { id: string }[];
  members: { id: string }[];
};

function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadProjects() {
    setError("");

    try {
      const response = await apiFetch("/api/projects", {
        credentials: "include",
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `Could not load projects (${response.status}): ${details}`
        );
      }

      const data = await response.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Load projects error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  async function createProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    try {
      const response = await apiFetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `Could not create project (${response.status}): ${details}`
        );
      }

      setName("");
      setDescription("");
      setShowForm(false);
      setLoading(true);
      await loadProjects();
    } catch (err) {
      console.error("Create project error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not create project. Please try again."
      );
    }
  }
  async function deleteProject() {
  if (!projectToDelete || deleting) return;

  setDeleting(true);
  setError("");

  try {
    const response = await apiFetch(
      `/api/projects/${projectToDelete.id}`,
      {
        method: "DELETE",
        credentials: "include",
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Could not delete project (${response.status}): ${details}`
      );
    }

    // Remove archived project from the visible list
    setProjects((previous) =>
      previous.filter((project) => project.id !== projectToDelete.id)
    );

    // Close confirmation dialog
    setProjectToDelete(null);
  } catch (err) {
    console.error("Delete project error:", err);
    setError(
      err instanceof Error
        ? err.message
        : "Could not delete project. Please try again."
    );
  } finally {
    setDeleting(false);
  }
}

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Projects</h2>
          <p>Manage your construction projects.</p>
        </div>

        <Link to="/projects/new" className="primary-button">
          + New Project
        </Link>
      </div>

      {showForm && (
        <form onSubmit={createProject} className="project-card">
          <h3>Create a Project</h3>

          <label htmlFor="project-name">Project Name</label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            placeholder="Enter project name"
          />

          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Describe the project"
          />

          <button type="submit" className="primary-button">
            Save Project
          </button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading projects...</p>
      ) : projects.length === 0 ? (
        <p>No projects yet. Select "+ New Project" to create one.</p>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <div className="project-card" key={project.id}>
              <div className="project-card-header">
                <h3>{project.name}</h3>
                <span className="project-status">Active</span>
              </div>

              <p className="project-description">
                {project.description || "No description provided."}
              </p>

              <div className="project-stats">
                <div>
                  <strong>{project.drawings?.length ?? 0}</strong>
                  <span>Drawings</span>
                </div>

                <div>
                  <strong>{project.punchItems?.length ?? 0}</strong>
                  <span>Punch Items</span>
                </div>

                <div>
                  <strong>{project.members?.length ?? 0}</strong>
                  <span>Members</span>
                </div>
              </div>

              <div className="project-actions">
                <Link to={`/projects/${project.id}`} className="view-project">
                  View Project →
                </Link>

                {project.currentRole === "ADMIN" && (
                  <button
                    type="button"
                    className="delete-project-button"
                    onClick={() => setProjectToDelete(project)}
                  >
                    Delete Project
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        {projectToDelete && (
    <div className="delete-confirmation-overlay">
      <div
        className="delete-confirmation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
      >
        <h3 id="delete-dialog-title">Delete Project?</h3>

        <p>
          Are you sure you want to remove
          <strong> {projectToDelete.name}</strong>?
        </p>

        <p>
          This project will be archived and removed from your
          project list. Its data will be preserved.
        </p>

        <div className="project-actions">
          <button
            type="button"
            disabled={deleting}
            onClick={() => setProjectToDelete(null)}
          >
            Cancel
          </button>

          <button
            type="button"
            className="delete-project-button"
            disabled={deleting}
            onClick={deleteProject}
          >
            {deleting ? "Deleting..." : "Confirm Delete"}
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}

export default Projects;
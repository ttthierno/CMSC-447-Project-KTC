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
  // Project currently being edited
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null);
  // Values displayed in the editing form
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  // Track saving and editing errors
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

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
function openEditProject(project: Project) {
  // Store the project being edited
  setProjectToEdit(project);

  // Populate the form with its current values
  setEditName(project.name);
  setEditDescription(project.description ?? "");

  // Clear previous errors
  setEditError("");
}
async function saveEditProject(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!projectToEdit || savingEdit) return;

  setSavingEdit(true);
  setEditError("");

  try {
    const response = await apiFetch(
      `/api/projects/${projectToEdit.id}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim(),
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Could not update project (${response.status}): ${details}`
      );
    }

    const updatedProject: Project = await response.json();

    // Update the project card without reloading the page
    setProjects((previous) =>
      previous.map((project) =>
        project.id === updatedProject.id ? updatedProject : project
      )
    );

    // Close the editor after a successful save
    setProjectToEdit(null);
  } catch (err) {
    console.error("Edit project error:", err);
    setEditError(
      err instanceof Error
        ? err.message
        : "Could not update project. Please try again."
    );
  } finally {
    setSavingEdit(false);
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

              <div className="project-actions edit-project-actions">
                <Link to={`/projects/${project.id}`} className="view-project">
                  View Project →
                </Link>
                {project.currentRole === "ADMIN" && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openEditProject(project)}
                  >
                    Edit Project
                  </button>
                )}

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
  {projectToEdit && (
  <div className="delete-confirmation-overlay">
    <div
      className="delete-confirmation-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-dialog-title"
    >
      <h3 id="edit-dialog-title">Edit Project</h3>

      <form onSubmit={saveEditProject}>
        <label htmlFor="edit-project-name">
          Project Name
        </label>

        <input
          id="edit-project-name"
          type="text"
          value={editName}
          onChange={(event) => setEditName(event.target.value)}
          maxLength={160}
          required
        />

        <label htmlFor="edit-project-description">
          Description
        </label>

        <textarea
          id="edit-project-description"
          value={editDescription}
          onChange={(event) =>
            setEditDescription(event.target.value)
          }
          maxLength={10000}
          rows={5}
        />

        {editError && (
          <p role="alert">{editError}</p>
        )}

        <div className="project-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={savingEdit}
            onClick={() => setProjectToEdit(null)}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="primary-button"
            disabled={savingEdit || !editName.trim()}
          >
            {savingEdit ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  </div>
  )}
    </div>
  );
}

export default Projects;
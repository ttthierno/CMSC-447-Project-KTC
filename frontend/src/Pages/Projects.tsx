
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Project = {
  id: number;
  name: string;
  description: string | null;
  drawings: { id: number }[];
  punchItems: { id: number }[];
};

function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  async function loadProjects() {
    try {
      const response = await fetch("http://localhost:3000/api/projects");

      if (!response.ok) {
        throw new Error("Could not load projects.");
      }

      const data = await response.json();
      setProjects(data);
    } catch {
      setError("Could not connect to the backend.");
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
      const response = await fetch("http://localhost:3000/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        throw new Error("Could not create project.");
      }

      setName("");
      setDescription("");
      setShowForm(false);
      setLoading(true);
      await loadProjects();
    } catch {
      setError("Could not create project. Please try again.");
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
                  <strong>—</strong>
                  <span>Members</span>
                </div>
              </div>

              <Link
                to={`/projects/${project.id}`}
                className="view-project"
              >
                View Project →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Projects;

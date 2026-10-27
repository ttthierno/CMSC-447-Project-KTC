import { apiFetch } from "../api";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function NewProject() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await apiFetch(
        "/api/projects",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim(),
          }),
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error("Project creation failed:", response.status, responseText);
        throw new Error(
          `Request failed (${response.status}): ${
            responseText || "No error details returned."
          }`
        );
      }

      navigate("/projects");
    } catch (err) {
      console.error("Create project error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not create project. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>New Project</h2>
          <p>Create a construction project in KonTraCk.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="project-card">
        <label htmlFor="project-name">Project Name</label>
        <input
          id="project-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter project name"
          required
        />

        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the project"
        />

        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? "Creating Project..." : "Create Project"}
        </button>

        <Link to="/projects">Cancel</Link>
      </form>
    </div>
  );
}

export default NewProject;

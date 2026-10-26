
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
      const response = await fetch(
        "http://localhost:3000/api/projects",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, description }),
        }
      );

      if (!response.ok) {
        throw new Error("Could not create project.");
      }

      await response.json();
      navigate("/projects");
    } catch {
      setError("Could not create project. Please try again.");
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

      <form 
        onSubmit={handleSubmit}
        className="project-card new-project-form"
      >
      <div className="form-group">
        <label htmlFor="project-name">Project Name</label>
        <input 
          id="project-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Enter project name"
          required
        />
      </div>
  
      <div className="form-group">
        <label htmlFor="project-description">Description</label>
        <textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the project"
          rows={4}
        />
      </div>

      {error && <p role="alert">{error}</p>}

      <div className="form-actions">
        <button
          type="submit"
          className="primary-button"
          disabled={loading}
        >
          {loading ? "Creating Project..." : "Create Project"}
        </button>

        <Link to="/projects" className="cancel-link">
          Cancel
        </Link>
          </div>
        </form>
      </div>
    );
  }

export default NewProject;

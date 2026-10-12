
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type TeamMember = {
  id: number;
  role: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

function Team() {
  const { id } = useParams<{ id: string }>();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("MEMBER");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Open a project's Team tab to manage its members.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMembers() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:3000/api/projects/${id}/members`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load team members.");
        }

        if (!cancelled) {
          setMembers(data);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Could not connect to the backend."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMembers();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addMember(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!id) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:3000/api/projects/${id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, role }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not add team member.");
      }

      setMembers((currentMembers) => [...currentMembers, data]);
      setName("");
      setEmail("");
      setRole("MEMBER");
      setShowForm(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not add team member."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!id) {
    return (
      <div className="page">
        <h2>Project Team</h2>
        <p>Open a project's Team tab to manage its members.</p>
        <Link to="/projects">View Projects</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Project Team</h2>
          <p>Manage members working on this project.</p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => {
            setShowForm(!showForm);
            setError("");
          }}
        >
          {showForm ? "Cancel" : "+ Add Member"}
        </button>
      </div>

      <p>
        <Link to={`/projects/${id}`}>
          ← Back to Project Overview
        </Link>
      </p>

      {showForm && (
        <form onSubmit={addMember} className="project-card">
          <h3>Add a Team Member</h3>

          <label htmlFor="member-name">Full Name</label>
          <input
            id="member-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter member's name"
            required
          />

          <label htmlFor="member-email">Email Address</label>
          <input
            id="member-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />

          <label htmlFor="member-role">Project Role</label>
          <select
            id="member-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="MEMBER">Project Member</option>
            <option value="ADMIN">Project Administrator</option>
          </select>

          <button
            type="submit"
            className="primary-button"
            disabled={submitting}
          >
            {submitting ? "Adding Member..." : "Save Member"}
          </button>
        </form>
      )}

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading team members...</p>
      ) : members.length === 0 ? (
        !error && <p>No team members yet. Add someone to this project.</p>
      ) : (
        <div className="team-grid">
          {members.map((member) => (
            <div className="team-card" key={member.id}>
              <div className="team-avatar">
                {member.user.name.charAt(0).toUpperCase()}
              </div>

              <div className="team-info">
                <h3>{member.user.name}</h3>
                <p>{member.user.email}</p>
                <span>
                  {member.role === "ADMIN"
                    ? "Project Administrator"
                    : "Project Member"}
                </span>
              </div>

              <span
                className={`team-role ${
                  member.role === "ADMIN" ? "admin" : ""
                }`}
              >
                {member.role === "ADMIN" ? "Admin" : "Member"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Team;


import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Drawing = {
  id: number;
  name: string;
};

type ProjectMember = {
  id: number;
  role: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
};

type PunchItemData = {
  id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdAt: string;
  drawing: Drawing | null;
  assignee: ProjectMember | null;
};

type Project = {
  id: number;
  name: string;
  description: string | null;
  drawings: Drawing[];
  members: ProjectMember[];
  punchItems: PunchItemData[];
};

function statusLabel(status: string) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");

  if (normalized === "IN_PROGRESS") return "In Progress";
  if (normalized === "COMPLETED") return "Completed";
  return "Open";
}

function statusClass(status: string) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_");

  if (normalized === "IN_PROGRESS") return "progress";
  if (normalized === "COMPLETED") return "completed";
  return "open";
}

function ProjectDashboard() {
  const { id } = useParams<{ id: string }>();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      if (!id) {
        setError("No project was selected.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `http://localhost:3000/api/projects/${id}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Could not load project.");
        }

        if (!cancelled) {
          setProject(data);
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

    loadProject();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="page"><p>Loading project dashboard...</p></div>;
  }

  if (error || !project) {
    return (
      <div className="page">
        <h2>Unable to Load Project</h2>
        <p role="alert">{error || "Project not found."}</p>
        <Link to="/projects">Back to Projects</Link>
      </div>
    );
  }

  const openCount = project.punchItems.filter(
    (item) => statusLabel(item.status) === "Open"
  ).length;

  const progressCount = project.punchItems.filter(
    (item) => statusLabel(item.status) === "In Progress"
  ).length;

  const completedCount = project.punchItems.filter(
    (item) => statusLabel(item.status) === "Completed"
  ).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>{project.name}</h2>
          <p>
            {project.description ||
              "Project overview and construction progress."}
          </p>
        </div>

        <Link
          to={`/projects/${project.id}/punch-list/new`}
          className="primary-button"
        >
          + New Punch Item
        </Link>
      </div>

      <div className="project-tabs">
        <Link
          to={`/projects/${project.id}`}
          className="project-tab active"
        >
          Overview
        </Link>

        <Link
          to={`/projects/${project.id}/plans`}
          className="project-tab"
        >
          Plans
        </Link>

        <Link
          to={`/projects/${project.id}/punch-list`}
          className="project-tab"
        >
          Punch List
        </Link>

        <Link
          to={`/projects/${project.id}/team`}
          className="project-tab"
        >
          Team
        </Link>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span>Total Punch Items</span>
          <strong>{project.punchItems.length}</strong>
        </div>

        <div className="stat-card">
          <span>Drawings</span>
          <strong>{project.drawings.length}</strong>
        </div>

        <div className="stat-card">
          <span>Team Members</span>
          <strong>{project.members.length}</strong>
        </div>

        <div className="stat-card">
          <span>Completed</span>
          <strong>{completedCount}</strong>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Punch Item Progress</h3>

          <Link
            to={`/projects/${project.id}/punch-list`}
            className="view-project"
          >
            View All →
          </Link>
        </div>

        <div className="dashboard-stats">
          <div className="stat-card">
            <span>Open</span>
            <strong>{openCount}</strong>
          </div>

          <div className="stat-card">
            <span>In Progress</span>
            <strong>{progressCount}</strong>
          </div>

          <div className="stat-card">
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Recent Punch Items</h3>

          <Link
            to={`/projects/${project.id}/punch-list`}
            className="view-project"
          >
            View All →
          </Link>
        </div>

        {project.punchItems.length === 0 ? (
          <p>No punch items have been added to this project yet.</p>
        ) : (
          <div className="punch-list">
            {project.punchItems.slice(0, 5).map((item) => (
              <div className="punch-item" key={item.id}>
                <div>
                  <Link
                    to={`/projects/${project.id}/punch-list/${item.id}`}
                  >
                    <strong>{item.title}</strong>
                  </Link>

                  <span>
                    {item.drawing?.name || "No drawing"} ·{" "}
                    {item.assignee?.user.name || "Unassigned"}
                  </span>
                </div>

                <span className={`punch-status ${statusClass(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h3>Project Team</h3>

          <Link
            to={`/projects/${project.id}/team`}
            className="view-project"
          >
            View Team →
          </Link>
        </div>

        {project.members.length === 0 ? (
          <p>No team members have been added to this project yet.</p>
        ) : (
          <div className="team-grid">
            {project.members.slice(0, 3).map((member) => (
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectDashboard;

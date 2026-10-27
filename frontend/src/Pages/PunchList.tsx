import { apiFetch } from "../api";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type Drawing = {
  id: string;
  name: string;
};

type PunchItemData = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string;
  drawingId: string | null;
  markerX: number | null;
  markerY: number | null;
};

type Project = {
  id: string;
  name: string;
  drawings: Drawing[];
  punchItems: PunchItemData[];
};

type ListItem = PunchItemData & {
  projectName: string;
  drawingName: string | null;
};

type Filter = "ALL" | "OPEN" | "IN_PROGRESS" | "READY_FOR_REVIEW" | "COMPLETED";

function PunchList() {
  const { projectId } = useParams<{ projectId: string }>();

  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<ListItem[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [newItemProject, setNewItemProject] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      setLoading(true);
      setError("");

      try {
        const response = await apiFetch("/api/projects");

        if (!response.ok) {
          throw new Error("Could not load projects and punch items.");
        }

        const data: Project[] = await response.json();

        if (cancelled) return;

        setProjects(data);

        const selectedProject = projectId
          ? data.find((project) => project.id === projectId)
          : null;

        if (projectId && !selectedProject) {
          throw new Error("Project not found.");
        }

        const selectedProjects = projectId
          ? data.filter((project) => project.id === projectId)
          : data;

        const allItems: ListItem[] = selectedProjects.flatMap((project) =>
          project.punchItems.map((item) => ({
            ...item,
            projectName: project.name,
            drawingName:
              project.drawings.find(
                (drawing) => drawing.id === item.drawingId
              )?.name ?? null,
          }))
        );

        setItems(allItems);
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

    loadItems();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filteredItems = items.filter((item) => {
    if (filter === "ALL") return true;

    const status = item.status.toUpperCase().replace(/\s+/g, "_");
    return status === filter;
  });

  function statusLabel(status: string) {
    const normalized = status.toUpperCase().replace(/\s+/g, "_");

    if (normalized === "IN_PROGRESS") return "In Progress";
    if (normalized === "COMPLETED") return "Closed";
    if (normalized === "READY_FOR_REVIEW") return "Ready for review";
    return "Open";
  }

  function statusClass(status: string) {
    const normalized = status.toUpperCase().replace(/\s+/g, "_");

    if (normalized === "IN_PROGRESS") return "progress";
    if (normalized === "COMPLETED") return "completed";
    return "open";
  }

  function priorityLabel(priority: string) {
    const normalized = priority.toUpperCase();
    if (normalized === "HIGH") return "High";
    if (normalized === "LOW") return "Low";
    return "Medium";
  }

  function priorityClass(priority: string) {
    const normalized = priority.toLowerCase();
    if (normalized === "high") return "priority-high";
    if (normalized === "low") return "priority-low";
    return "priority-medium";
  }

  const newItemUrl = projectId
    ? `/projects/${projectId}/plans`
    : newItemProject
      ? `/projects/${newItemProject}/plans`
      : null;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Punch List</h2>
          <p>
            {projectId
              ? "Track and manage this project's punch-list items."
              : "Track and manage punch-list items across your projects."}
          </p>
        </div>

        {newItemUrl ? (
          <Link to={newItemUrl} className="primary-button">
            + New Punch Item
          </Link>
        ) : (
          <button
            type="button"
            className="primary-button"
            disabled
          >
            + New Punch Item
          </button>
        )}
      </div>

      {!projectId && projects.length > 0 && (
        <div className="project-card">
          <label htmlFor="new-item-project">
            Select a project for your new punch item
          </label>
          <select
            id="new-item-project"
            value={newItemProject}
            onChange={(event) => setNewItemProject(event.target.value)}
          >
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="punch-filters">
        {(
          [
            ["ALL", "All"],
            ["OPEN", "Open"],
            ["IN_PROGRESS", "In Progress"],
            ["READY_FOR_REVIEW", "Ready for review"],
            ["COMPLETED", "Closed"],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`filter-button ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}

      {loading ? (
        <p>Loading punch items...</p>
      ) : (
        <div className="punch-table">
          <div className="punch-table-header">
            <span>Item</span>
            <span>{projectId ? "Drawing / Location" : "Project / Drawing"}</span>
            <span>Assigned To</span>
            <span>Priority</span>
            <span>Status</span>
          </div>

          {filteredItems.length === 0 ? (
            <p>
              {error
                ? "Punch items could not be loaded."
                : "No punch items match this filter yet."}
            </p>
          ) : (
            filteredItems.map((item) => (
              <Link
                key={`${item.projectId}-${item.id}`}
                to={`/projects/${item.projectId}/punch-list/${item.id}`}
                className="punch-table-row"
              >
                <div>
                  <strong>{item.title}</strong>
                  <span>#{item.id}</span>
                </div>

                <span>
                  {projectId ? "" : `${item.projectName} · `}
                  {item.drawingName ?? "Not pinned to a drawing"}
                </span>

                <span>Unassigned</span>

                <span className={priorityClass(item.priority)}>
                  {priorityLabel(item.priority)}
                </span>

                <span className={`punch-status ${statusClass(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default PunchList;

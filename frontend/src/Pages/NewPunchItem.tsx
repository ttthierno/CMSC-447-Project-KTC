import { apiFetch } from "../api";

import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

function NewPunchItem() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const drawingIdValue = searchParams.get("drawingId");
  const pageNumberValue = searchParams.get("pageNumber");
  const markerXValue = searchParams.get("markerX");
  const markerYValue = searchParams.get("markerY");

  const drawingId =
    drawingIdValue;
  const pageNumber =
    pageNumberValue !== null ? Number(pageNumberValue) : null;
  const markerX = markerXValue !== null ? Number(markerXValue) : null;
  const markerY = markerYValue !== null ? Number(markerYValue) : null;

  const hasMarker =
    drawingId !== null &&
    /^[0-9a-f-]{36}$/i.test(drawingId) &&
    pageNumber !== null &&
    Number.isInteger(pageNumber) &&
    pageNumber > 0 &&
    markerX !== null &&
    Number.isFinite(markerX) &&
    markerX >= 0 &&
    markerX <= 1 &&
    markerY !== null &&
    Number.isFinite(markerY) &&
    markerY >= 0 &&
    markerY <= 1;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    if (!projectId || !hasMarker) {
      setError("Choose a location on a project drawing first.");
      return;
    }

    setLoading(true);

    try {
      const body: {
        title: string;
        description: string;
        priority: string;
        drawingId?: string;
        pageNumber?: number;
        markerX?: number;
        markerY?: number;
      } = {
        title,
        description,
        priority,
      };

      if (hasMarker) {
        body.drawingId = drawingId!;
        body.pageNumber = pageNumber!;
        body.markerX = markerX!;
        body.markerY = markerY!;
      }

      const response = await apiFetch(
        `/api/projects/${projectId}/punch-items`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not create punch item.");
      }

      navigate(`/projects/${projectId}/punch-list/${data.id}`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <Link to={projectId ? `/projects/${projectId}/plans` : "/projects"}>
        ← Back to Plans
      </Link>

      <div className="page-header">
        <div>
          <h2>New Punch Item</h2>
          <p>Create and document an issue for this project.</p>
        </div>
      </div>

      {!hasMarker && <p role="alert">Open Plans and select the drawing location before creating an item.</p>}
      {hasMarker && (
        <div className="detail-card">
          <strong>Drawing location selected</strong>
          <p>
            Page {pageNumber}. The marker location will
            be saved with this punch item.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="detail-card">
        <label htmlFor="punch-title">Issue Title</label>
        <input
          id="punch-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Verify the door closer"
          maxLength={200}
          required
        />

        <label htmlFor="punch-description">Description</label>
        <textarea
          id="punch-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe the issue"
          rows={4}
          required
          maxLength={10000}
        />

        <label htmlFor="punch-priority">Priority</label>
        <select
          id="punch-priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>

        {error && <p role="alert">{error}</p>}

        <button
          type="submit"
          className="primary-button"
          disabled={loading || !hasMarker}
        >
          {loading ? "Creating Punch Item..." : "Create Punch Item"}
        </button>
      </form>
    </div>
  );
}

export default NewPunchItem;

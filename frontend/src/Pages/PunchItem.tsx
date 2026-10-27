import { apiFetch } from "../api";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API_URL = "";

type ProjectMember = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type PunchComment = {
  id: string;
  content: string;
  createdAt: string;
};

type PunchPhoto = {
  id: string;
  fileUrl: string;
  originalName: string;
  createdAt: string;
};

type PunchItemData = {
  version: number;
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  projectId: string;
  drawingId: string | null;
  pageNumber: number | null;
  markerX: number | null;
  markerY: number | null;
  drawing: { id: string; name: string } | null;
  assignee: ProjectMember | null;
  comments: PunchComment[];
  photos: PunchPhoto[];
};

function PunchItem() {
  const { projectId, id } = useParams<{
    projectId: string;
    id: string;
  }>();

  const [item, setItem] = useState<PunchItemData | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingComment, setSavingComment] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      if (!projectId || !id) {
        setError("Project or punch-item ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [itemsResponse, membersResponse] = await Promise.all([
          apiFetch(`${API_URL}/api/projects/${projectId}/punch-items`),
          apiFetch(`${API_URL}/api/projects/${projectId}/members`),
        ]);

        const itemsData = await itemsResponse.json();
        const membersData = await membersResponse.json();

        if (!itemsResponse.ok) {
          throw new Error(
            itemsData.error || "Could not load punch items."
          );
        }

        if (!membersResponse.ok) {
          throw new Error(
            membersData.error || "Could not load project members."
          );
        }

        const found = itemsData.find(
          (entry: PunchItemData) => entry.id === id
        );

        if (!found) {
          throw new Error("Punch item not found in this project.");
        }

        if (!cancelled) {
          setItem({
            ...found,
            comments: found.comments ?? [],
            photos: found.photos ?? [],
          });
          setMembers(membersData);
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

    loadData();

    return () => {
      cancelled = true;
    };
  }, [projectId, id]);

  async function updateItem(values: {
    title?: string;
    description?: string;
    status?: string;
    assigneeId?: string | null;
  }) {
    if (!projectId || !id || !item) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `${API_URL}/api/projects/${projectId}/punch-items/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...values, version: item.version }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not update punch item.");
      }

      setItem((current) =>
        current
          ? {
              ...current,
              ...data,
              comments: current.comments,
              photos: current.photos,
            }
          : current
      );

      setMessage("Changes saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  async function addComment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!projectId || !id || !comment.trim()) return;

    setSavingComment(true);
    setCommentError("");
    setMessage("");

    try {
      const response = await apiFetch(
        `${API_URL}/api/projects/${projectId}/punch-items/${id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content: comment.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save comment.");
      }

      setItem((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, data],
            }
          : current
      );

      setComment("");
      setMessage("Comment saved.");
    } catch (error) {
      setCommentError(
        error instanceof Error
          ? error.message
          : "Could not save comment."
      );
    } finally {
      setSavingComment(false);
    }
  }

  async function uploadPhoto(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !projectId || !id) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setPhotoError("Choose a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("The image must be no larger than 10 MB.");
      return;
    }

    setUploadingPhoto(true);
    setPhotoError("");
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch(
        `${API_URL}/api/projects/${projectId}/punch-items/${id}/photos`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not upload photo.");
      }

      setItem((current) =>
        current
          ? {
              ...current,
              photos: [data, ...current.photos],
            }
          : current
      );

      setMessage("Photo uploaded successfully.");
    } catch (error) {
      setPhotoError(
        error instanceof Error
          ? error.message
          : "Could not upload photo."
      );
    } finally {
      setUploadingPhoto(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p>Loading punch item...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="page">
        <h2>Unable to Load Punch Item</h2>
        <p role="alert">{error || "Punch item not found."}</p>
        <Link to={`/projects/${projectId}/punch-list`}>
          Back to Punch List
        </Link>
      </div>
    );
  }

  const statusLabel = item.status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const priorityLabel =
    item.priority.charAt(0).toUpperCase() +
    item.priority.slice(1).toLowerCase();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link
            to={`/projects/${item.projectId}/punch-list`}
            className="back-link"
          >
            ← Back to Punch List
          </Link>

          <h2>{item.title}</h2>

          <p>
            Punch-list item #{item.id.slice(0,8)} ·{" "}
            {item.drawing?.name || "No drawing linked"}
            {item.pageNumber ? ` · Page ${item.pageNumber}` : ""}
          </p>
        </div>

        <span
          className={`large-status ${item.status
            .toLowerCase()
            .replace("_", "-")}`}
        >
          {statusLabel}
        </span>
      </div>

      {error && <p role="alert">{error} <button onClick={() => window.location.reload()}>Reload item</button></p>}
      {message && <p role="status">{message}</p>}

      <div className="punch-detail-layout">
        <div className="punch-detail-main">
          <div className="detail-card">
            <h3>Edit punch item</h3>
            <form key={item.version} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void updateItem({title: String(data.get('title')), description: String(data.get('description'))}); }}>
              <label htmlFor="edit-title">Title</label><input id="edit-title" name="title" defaultValue={item.title} maxLength={200} required />
              <label htmlFor="edit-description">Description</label><textarea id="edit-description" name="description" defaultValue={item.description || ''} maxLength={10000} rows={4} required />
              <p>Saved version {item.version}. The drawing location stays fixed.</p>
              <button className="primary-button" type="submit" disabled={saving}>Save item</button>
            </form>
            <Link to={`/projects/${item.projectId}/plans?drawingId=${item.drawingId}&page=${item.pageNumber}`}>View saved marker on drawing</Link>
          </div>

          <div className="detail-card">
            <h3>Photos ({item.photos.length})</h3>

            {item.photos.length === 0 ? (
              <div className="photo-placeholder">
                No photos uploaded yet
              </div>
            ) : (
              <div className="uploaded-photos">
                {item.photos.map((photo) => (
                  <div key={photo.id}>
                    <a
                      href={`${API_URL}${photo.fileUrl}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`${API_URL}${photo.fileUrl}`}
                        alt={photo.originalName}
                        className="uploaded-photo"
                        loading="lazy"
                      />
                    </a>
                    <p>{photo.originalName}</p>
                    <small>
                      {new Date(photo.createdAt).toLocaleString()}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <label className="upload-button">
              {uploadingPhoto ? "Uploading..." : "+ Add Photo"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadPhoto}
                disabled={uploadingPhoto}
                hidden
              />
            </label>

            {photoError && <p role="alert">{photoError}</p>}
          </div>

          <div className="detail-card">
            <h3>Comments ({item.comments.length})</h3>

            {item.comments.length === 0 ? (
              <p>No comments yet.</p>
            ) : (
              <div className="comments-list">
                {item.comments.map((savedComment) => (
                  <div className="comment" key={savedComment.id}>
                    <p>{savedComment.content}</p>
                    <small>
                      {new Date(savedComment.createdAt).toLocaleString()}
                    </small>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addComment}>
              <label htmlFor="comment-input">Add a comment</label>
              <textarea
                id="comment-input"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add an update about this issue..."
                className="comment-input"
                rows={3}
                required
              />

              {commentError && <p role="alert">{commentError}</p>}

              <button
                type="submit"
                className="primary-button"
                disabled={savingComment || !comment.trim()}
              >
                {savingComment ? "Saving..." : "Add Comment"}
              </button>
            </form>
          </div>
        </div>

        <div className="punch-detail-sidebar">
          <div className="detail-card">
            <h3>Item Details</h3>

            <div className="detail-row">
              <span>Status</span>
              <strong>{statusLabel}</strong>
            </div>

            <div className="detail-row">
              <span>Priority</span>
              <strong>{priorityLabel}</strong>
            </div>

            <div className="detail-row">
              <span>Location</span>
              <strong>
                {item.markerX !== null && item.markerY !== null
                  ? `${Math.round(item.markerX * 100)}% across, ${Math.round(item.markerY * 100)}% down`
                  : "Not set"}
              </strong>
            </div>

            <div className="detail-row">
              <span>Drawing</span>
              <strong>{item.drawing?.name || "Not linked"}</strong>
            </div>

            <div className="detail-row">
              <span>Assigned To</span>
              <strong>{item.assignee?.user.name || "Unassigned"}</strong>
            </div>
          </div>

          <div className="detail-card">
            <h3>Actions</h3>

            <label className="action-label" htmlFor="item-assignee">
              Assign To
            </label>

            <select
              id="item-assignee"
              className="action-select"
              value={item.assignee?.id ?? ""}
              disabled={saving}
              onChange={(event) =>
                updateItem({
                  assigneeId: event.target.value
                    ? event.target.value
                    : null,
                })
              }
            >
              <option value="">Unassigned</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.user.name}
                </option>
              ))}
            </select>

            <label className="action-label" htmlFor="item-status">
              Status
            </label>

            <select
              id="item-status"
              className="action-select"
              value={item.status.toUpperCase()}
              disabled={saving}
              onChange={(event) =>
                updateItem({ status: event.target.value })
              }
            >
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="READY_FOR_REVIEW">Ready for review</option>
              <option value="COMPLETED">Closed</option>
            </select>

            {saving && <p>Saving changes...</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PunchItem;

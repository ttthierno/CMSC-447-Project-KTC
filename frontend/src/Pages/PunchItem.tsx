import { useState } from "react"
import { Link, useParams } from "react-router-dom"

function PunchItem() {

  const { id } = useParams()

  const items = {
    "1": {
      title: "Electrical Outlet Issue",
      description:
        "Electrical outlet is not properly installed and needs to be inspected and repaired.",
      location: "Room 101",
      drawing: "A-101",
      priority: "High",
      assignedTo: "Unassigned",
      status: "Open"
    },

    "2": {
      title: "Wall Paint Needs Repair",
      description:
        "Wall paint needs to be repaired and the affected area should be repainted.",
      location: "Room 305",
      drawing: "A-101",
      priority: "Medium",
      assignedTo: "Kiishi",
      status: "In Progress"
    },

    "3": {
      title: "Door Hardware Missing",
      description:
        "Door hardware is missing and needs to be installed.",
      location: "Room 112",
      drawing: "A-102",
      priority: "Low",
      assignedTo: "Thierno",
      status: "Completed"
    }
  }

  const item =
    items[id as keyof typeof items] || items["1"]

  const [status, setStatus] = useState(item.status)
  const [assignedTo, setAssignedTo] = useState(item.assignedTo)
  const [comment, setComment] = useState("")
  const [photo, setPhoto] = useState<string | null>(null)

  return (
    <div className="page">

      <div className="page-header">

        <div>

          <Link
            to="/punch-list"
            className="back-link"
          >
            ← Back to Punch List
          </Link>

          <h2>{item.title}</h2>

          <p>
            Punch-list item #{id} · {item.drawing} · {item.location}
          </p>

        </div>

        <span
          className={`large-status ${
            status.toLowerCase().replace(" ", "-")
          }`}
        >
          {status}
        </span>

      </div>

      <div className="punch-detail-layout">

        <div className="punch-detail-main">

          <div className="detail-card">

            <h3>Description</h3>

            <p>
              {item.description}
            </p>

          </div>

          <div className="detail-card">

            <h3>Photos</h3>

            {photo ? (
              <img
                src={photo}
                alt="Punch-list item"
                className="uploaded-photo"
              />
            ) : (
              <div className="photo-placeholder">
                No photos uploaded
              </div>
            )}

            <label className="upload-button">

              + Add Photo

              <input
                type="file"
                accept="image/*"
                onChange={(event) => {

                  const file =
                    event.target.files?.[0]

                  if (file) {
                    setPhoto(
                      URL.createObjectURL(file)
                    )
                  }

                }}
                hidden
              />

            </label>

          </div>

          <div className="detail-card">

            <h3>Comments</h3>

            <textarea
              value={comment}
              onChange={(event) =>
                setComment(event.target.value)
              }
              placeholder="Add a comment..."
              className="comment-input"
            />

            <button
              className="primary-button"
              onClick={() => {

                if (comment.trim() !== "") {
                  alert("Comment added!")
                  setComment("")
                }

              }}
            >
              Add Comment
            </button>

          </div>

        </div>

        <div className="punch-detail-sidebar">

          <div className="detail-card">

            <h3>Item Details</h3>

            <div className="detail-row">
              <span>Status</span>
              <strong>{status}</strong>
            </div>

            <div className="detail-row">
              <span>Priority</span>
              <strong>{item.priority}</strong>
            </div>

            <div className="detail-row">
              <span>Location</span>
              <strong>{item.location}</strong>
            </div>

            <div className="detail-row">
              <span>Drawing</span>
              <strong>{item.drawing}</strong>
            </div>

            <div className="detail-row">
              <span>Assigned To</span>
              <strong>{assignedTo}</strong>
            </div>

          </div>

          <div className="detail-card">

            <h3>Actions</h3>

            <label className="action-label">
              Assign To
            </label>

            <select
              value={assignedTo}
              onChange={(event) =>
                setAssignedTo(event.target.value)
              }
              className="action-select"
            >
              <option>Unassigned</option>
              <option>Kiishi</option>
              <option>Thierno</option>
              <option>Chase</option>
            </select>

            <label className="action-label">
              Status
            </label>

            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value)
              }
              className="action-select"
            >
              <option>Open</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>

          </div>

        </div>

      </div>

    </div>
  )
}

export default PunchItem
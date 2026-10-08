import { Link } from "react-router-dom"

function Projects() {
  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h2>Projects</h2>
          <p>Manage your construction projects.</p>
        </div>

        <button className="primary-button">
          + New Project
        </button>
      </div>

      <div className="projects-grid">

        <div className="project-card">
          <div className="project-card-header">
            <h3>UMBC Construction Project</h3>
            <span className="project-status">Active</span>
          </div>

          <p className="project-description">
            Main construction project and punch-list management.
          </p>

          <div className="project-stats">
            <div>
              <strong>12</strong>
              <span>Drawings</span>
            </div>

            <div>
              <strong>24</strong>
              <span>Punch Items</span>
            </div>

            <div>
              <strong>8</strong>
              <span>Members</span>
            </div>
          </div>

          <Link to="/projects/1" className="view-project">
            View Project →
          </Link>
        </div>


        <div className="project-card">
          <div className="project-card-header">
            <h3>Student Center Renovation</h3>
            <span className="project-status">Active</span>
          </div>

          <p className="project-description">
            Student center renovation and inspection tracking.
          </p>

          <div className="project-stats">
            <div>
              <strong>8</strong>
              <span>Drawings</span>
            </div>

            <div>
              <strong>13</strong>
              <span>Punch Items</span>
            </div>

            <div>
              <strong>6</strong>
              <span>Members</span>
            </div>
          </div>

          <button className="view-project">
            View Project →
          </button>
        </div>


        <div className="project-card">
          <div className="project-card-header">
            <h3>Engineering Building</h3>
            <span className="project-status">Active</span>
          </div>

          <p className="project-description">
            Engineering building construction and quality tracking.
          </p>

          <div className="project-stats">
            <div>
              <strong>15</strong>
              <span>Drawings</span>
            </div>

            <div>
              <strong>31</strong>
              <span>Punch Items</span>
            </div>

            <div>
              <strong>10</strong>
              <span>Members</span>
            </div>
          </div>

          <button className="view-project">
            View Project →
          </button>
        </div>

      </div>

    </div>
  )
}

export default Projects
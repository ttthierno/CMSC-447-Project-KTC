import { Link } from "react-router-dom"

function ProjectDashboard() {
  return (
    <div className="page">
      <h2>UMBC Construction Project</h2>

      <p>Project overview and construction progress.</p>

            <div className="project-tabs">

        <Link to="/projects/1" className="project-tab active">
          Overview
        </Link>

        <Link to="/projects/1/plans" className="project-tab">
          Plans
        </Link>

        <Link to="/punch-list" className="project-tab">
         Punch List
        </Link>

        <Link to="/projects/1/team" className="project-tab">
          Team
        </Link>

      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <span>Punch Items</span>
          <strong>24</strong>
        </div>

        <div className="stat-card">
          <span>Drawings</span>
          <strong>12</strong>
        </div>

        <div className="stat-card">
          <span>Team Members</span>
          <strong>8</strong>
        </div>

        <div className="stat-card">
          <span>Completed</span>
          <strong>16</strong>
        </div>
      </div>
            <div className="dashboard-section">

        <div className="section-header">
          <h3>Recent Punch Items</h3>

          <Link to="/punch-list" className="view-project">
            View All →
            </Link>
        </div>

        <div className="punch-list">

          <div className="punch-item">
            <div>
              <strong>Electrical outlet issue</strong>
              <span>Room 201 · Electrical</span>
            </div>

            <span className="punch-status open">
              Open
            </span>
          </div>

          <div className="punch-item">
            <div>
              <strong>Wall paint needs repair</strong>
              <span>Room 305 · Interior</span>
            </div>

            <span className="punch-status progress">
              In Progress
            </span>
          </div>

          <div className="punch-item">
            <div>
              <strong>Door hardware missing</strong>
              <span>Room 112 · Hardware</span>
            </div>

            <span className="punch-status completed">
              Completed
            </span>
          </div>

        </div>

      </div>
    </div>
  )
}

export default ProjectDashboard
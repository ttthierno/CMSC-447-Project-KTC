import { Link } from "react-router-dom"

function PunchList() {
  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h2>Punch List</h2>
          <p>Track and manage project punch-list items.</p>
        </div>

        <Link
          to="/projects/1/punch-list/new"
          className="primary-button"
        >
          + New Punch Item
        </Link>
      </div>

      <div className="punch-filters">

        <button className="filter-button active">
          All
        </button>

        <button className="filter-button">
          Open
        </button>

        <button className="filter-button">
          In Progress
        </button>

        <button className="filter-button">
          Completed
        </button>

      </div>

      <div className="punch-table">

        <div className="punch-table-header">
          <span>Item</span>
          <span>Location</span>
          <span>Assigned To</span>
          <span>Priority</span>
          <span>Status</span>
        </div>

        <Link
          to="/projects/1/punch-list/1"
          className="punch-table-row"
        >
          <div>
            <strong>Electrical Outlet Issue</strong>
            <span>#1</span>
          </div>

          <span>Room 101 · A-101</span>
          <span>Unassigned</span>
          <span className="priority-high">High</span>
          <span className="punch-status open">Open</span>
        </Link>

        <Link
          to="/projects/1/punch-list/2"
          className="punch-table-row"
        >
          <div>
            <strong>Wall Paint Needs Repair</strong>
            <span>#2</span>
          </div>

          <span>Room 305 · A-101</span>
          <span>Kiishi</span>
          <span className="priority-medium">Medium</span>
          <span className="punch-status progress">
            In Progress
          </span>
        </Link>

        <Link
          to="/projects/1/punch-list/3"
          className="punch-table-row"
        >
          <div>
            <strong>Door Hardware Missing</strong>
            <span>#3</span>
          </div>

          <span>Room 112 · A-102</span>
          <span>Thierno</span>
          <span className="priority-low">Low</span>
          <span className="punch-status completed">
            Completed
          </span>
        </Link>

      </div>

    </div>
  )
}

export default PunchList
function Team() {
  return (
    <div className="page">

      <div className="page-header">
        <div>
          <h2>Project Team</h2>
          <p>Manage members working on this project.</p>
        </div>

        <button className="primary-button">
          + Add Member
        </button>
      </div>

      <div className="team-grid">

        <div className="team-card">
          <div className="team-avatar">K</div>

          <div className="team-info">
            <h3>Kiishi</h3>
            <p>Project Administrator</p>
            <span>8 Punch Items Assigned</span>
          </div>

          <span className="team-role admin">
            Admin
          </span>
        </div>

        <div className="team-card">
          <div className="team-avatar">T</div>

          <div className="team-info">
            <h3>Thierno</h3>
            <p>Project Member</p>
            <span>6 Punch Items Assigned</span>
          </div>

          <span className="team-role">
            Member
          </span>
        </div>

        <div className="team-card">
          <div className="team-avatar">C</div>

          <div className="team-info">
            <h3>Chase</h3>
            <p>Project Member</p>
            <span>5 Punch Items Assigned</span>
          </div>

          <span className="team-role">
            Member
          </span>
        </div>

      </div>

    </div>
  )
}

export default Team
function UserSetup() {
  return (
    <div className="settings-page">

      <div className="settings-content">

        {/* PROFILE */}

        <div className="settings-section-header">
          <div className="settings-section-line"></div>
          <span>PROFILE</span>
        </div>

        <div className="settings-module profile-module">

          <div className="profile-summary">

            <div className="large-profile-avatar">
              K
            </div>

            <div className="profile-identity">

              <h2>Kiishi</h2>

              <p className="profile-email">
                iedgal1@umbc.edu
              </p>

              <p className="profile-organization">
                UMBC
              </p>

              <div className="profile-phone">
                <span>Phone</span>
                <strong>Not provided</strong>
              </div>

            </div>

            <button className="settings-button">
              Edit Profile
            </button>

          </div>

        </div>


        {/* PLAN */}

        <div className="settings-section-header">
          <div className="settings-section-line"></div>
          <span>PLAN</span>
        </div>

        <div className="settings-module">

          <div className="settings-info-row">

            <div className="settings-info">
              <span>Plan</span>
              <strong>Basic</strong>
            </div>

            <div className="settings-info">
              <span>User Count</span>
              <strong>Not provided</strong>
            </div>

            <div className="settings-info">
              <span>Status</span>
              <strong>Not provided</strong>
            </div>

            <button className="gold-button">
              Manage Subscription
            </button>

          </div>

          <p className="settings-description">
            Review your plan and manage your subscription.
          </p>

        </div>


        {/* API */}

        <div className="settings-section-header">
          <div className="settings-section-line"></div>
          <span>API</span>
        </div>

        <div className="settings-module">

          <div className="settings-info-row">

            <div className="settings-info">
              <span>API Access</span>

              <strong className="api-status">
                <span className="status-dot"></span>
                Disabled
              </strong>
            </div>

            <div className="settings-info">
              <span>Tokens</span>
              <strong className="large-number">0</strong>
            </div>

            <div className="settings-info">

              <span>Documentation</span>

              <a href="#" className="api-link">
                API Documentation ↗
              </a>

            </div>

            <button className="gold-button">
              Request API Developer Access
            </button>

          </div>

          <p className="settings-description">
            Request developer access to connect your tools with KonTraCk.
          </p>

        </div>

      </div>

    </div>
  )
}

export default UserSetup
import { Link } from "react-router-dom"

function Plans() {
  return (
    <div className="page">

      <div className="page-header">

        <div>
          <h2>Plans</h2>
          <p>
            View project drawings and punch-list locations.
          </p>
        </div>

        <button className="primary-button">
          + Upload Drawing
        </button>

      </div>

      <div className="plans-layout">

        <div className="drawings-list">

          <h3>Drawings</h3>

          <div className="drawing-item active">
            <strong>A-101</strong>
            <span>Floor Plan 1</span>
          </div>

          <div className="drawing-item">
            <strong>A-102</strong>
            <span>Floor Plan 2</span>
          </div>

          <div className="drawing-item">
            <strong>A-201</strong>
            <span>Elevations</span>
          </div>

          <div className="drawing-item">
            <strong>S-101</strong>
            <span>Structural Plan</span>
          </div>

        </div>

        <div className="drawing-viewer">

          <div className="drawing-header">

            <div>
              <strong>A-101</strong>
              <span>Floor Plan 1</span>
            </div>

            <div className="drawing-tools">

              <button>−</button>
              <button>+</button>
              <button>Fit</button>

              <Link
                to="/punch-list"
                className="drawing-punch-link"
              >
                Punch List
              </Link>

            </div>

          </div>

          <div className="drawing-canvas">

            <div className="floor-plan">

              <div className="room room-one">
                <span>Room 101</span>
              </div>

              <div className="room room-two">
                <span>Room 102</span>
              </div>

              <div className="room room-three">
                <span>Room 103</span>
              </div>

              <div className="room room-four">
                <span>Room 104</span>
              </div>

              <div className="hallway">
                Hallway
              </div>

              <Link
                to="/projects/1/punch-list/1"
                className="drawing-pin pin-one"
                title="Electrical Outlet Issue"
              >
                1
              </Link>

              <Link
                to="/projects/1/punch-list/2"
                className="drawing-pin pin-two"
                title="Wall Paint Needs Repair"
              >
                2
              </Link>

              <Link
                to="/projects/1/punch-list/3"
                className="drawing-pin pin-three"
                title="Door Hardware Missing"
              >
                3
              </Link>

            </div>

          </div>

          <div className="drawing-legend">

            <span>
              <span className="legend-pin">1</span>
              Open
            </span>

            <span>
              <span className="legend-pin">2</span>
              In Progress
            </span>

            <span>
              <span className="legend-pin">3</span>
              Completed
            </span>

          </div>

        </div>

      </div>

    </div>
  )
}

export default Plans
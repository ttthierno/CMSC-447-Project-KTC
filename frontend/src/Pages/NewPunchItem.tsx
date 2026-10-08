import { Link } from "react-router-dom"

function NewPunchItem() {
  return (
    <div className="page">

      <Link to="/punch-list">
        ← Back to Punch List
      </Link>

      <h2>New Punch Item</h2>

      <p>Create a new punch-list item.</p>

      <div className="detail-card">

        <p>New punch item form will go here.</p>

        <button className="primary-button">
          Create Punch Item
        </button>

      </div>

    </div>
  )
}

export default NewPunchItem
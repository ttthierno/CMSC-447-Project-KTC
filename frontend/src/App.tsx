import './App.css'
import './Projects.css';
import './ProjectDashboard.css';

import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import Projects from "./Pages/Projects"
import ProjectDashboard from "./Pages/ProjectDashboard"
import Plans from "./Pages/Plans"
import NewProject from "./Pages/NewProject";
import PunchItem from "./Pages/PunchItem"
import PunchList from "./Pages/PunchList"
import Team from "./Pages/Team"
import NewPunchItem from "./Pages/NewPunchItem"
import UserSetup from "./Pages/UserSetup"

import { BrowserRouter, Routes, Route, Link } from "react-router-dom"


function App() {
  return (
    <BrowserRouter>

      <div className="app">

        {/* SIDEBAR */}

        <aside className="sidebar">

          <div className="sidebar-logo">

            <div className="sidebar-logo-mark">
              K
            </div>

            <div className="sidebar-logo-text">
              <span>K</span>on<span>T</span>ra<span>C</span>k
            </div>

          </div>


          <nav className="navigation">

            <Link to="/" className="nav-item">
              <span className="nav-icon">⌂</span>
              <span>Home</span>
            </Link>

            <Link to="/projects" className="nav-item">
              <span className="nav-icon">▣</span>
              <span>Projects</span>
            </Link>

            <Link to="/drawings" className="nav-item">
              <span className="nav-icon">▤</span>
              <span>Drawings</span>
            </Link>

            <Link to="/punch-list" className="nav-item">
              <span className="nav-icon">✓</span>
              <span>Punch List</span>
            </Link>

            <Link to="/team" className="nav-item">
              <span className="nav-icon">♙</span>
              <span>Team</span>
            </Link>

          </nav>


          <div className="sidebar-spacer"></div>


          <div className="sidebar-settings">

            <Link
              to="/settings"
              className="nav-item settings-nav-item"
            >
              <span className="settings-active-indicator"></span>

              <span className="nav-icon">⚙</span>

              <span>Settings</span>
            </Link>

          </div>

        </aside>


        {/* MAIN WORKSPACE */}

        <main className="main-content">

          <header className="top-bar">
            <h1>TEST CONTENT</h1>

            <h1>Settinnngsss</h1>

            <div className="top-user">

              <div className="top-user-avatar">
                K
              </div>

              <div className="top-user-info">
                <strong>Kiishi</strong>
                <span>UMBC</span>
              </div>

              <span className="top-user-chevron">
                ˅
              </span>

            </div>

          </header>


          <Routes>

            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            <Route path="/" element={<Home />} />

            <Route
              path="/projects"
              element={<Projects />}
            />

            <Route
              path="/projects/:id"
              element={<ProjectDashboard />}
            />

<Route
  path="/test"
  element={<h1>ROUTING WORKS!</h1>}
/>

            <Route path="/projects/new" element={<NewProject />} />

            <Route
              path="/projects/:id/plans"
              element={<Plans />}
            />

            <Route
              path="/projects/:projectId/punch-list/new"
              element={<NewPunchItem />}
            />

            <Route
              path="/projects/:projectId/punch-list"
              element={<PunchList />}
            />

            <Route
              path="/projects/:projectId/punch-list/:id"
              element={<PunchItem />}
            />

            <Route
              path="/projects/:id/team"
              element={<Team />}
            />

            <Route
              path="/team"
              element={<Team />}
            />

            <Route
              path="/drawings"
              element={<PagePlaceholder title="Drawings" />}
            />

            <Route
              path="/punch-list"
              element={<PunchList />}
            />

            <Route
              path="/settings"
              element={<UserSetup />}
            />

          </Routes>

        </main>

      </div>

    </BrowserRouter>
  )
}


function Home() {
  return (
    <div className="page">

      <div className="page-header">

        <div>
          <h2>Welcome to KonTraCk</h2>

          <p>
            Select a section from the sidebar to get started.
          </p>
        </div>

      </div>

    </div>
  )
}


function PagePlaceholder({
  title
}: {
  title: string
}) {
  return (
    <div className="page">

      <div className="page-header">

        <div>
          <h2>{title}</h2>

          <p>
            This section will be built next.
          </p>
        </div>

      </div>

    </div>
  )
}


export default App
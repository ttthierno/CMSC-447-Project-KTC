import './App.css';
import './integration.css';
import './Projects.css';
import './ProjectDashboard.css';

import { useState, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';

import Home from './Pages/Home';
import Login from './Pages/Login';
import Signup from './Pages/Signup';
import Projects from './Pages/Projects';
import ProjectDashboard from './Pages/ProjectDashboard';
import Plans from './Pages/Plans';
import NewProject from './Pages/NewProject';
import PunchItem from './Pages/PunchItem';
import PunchList from './Pages/PunchList';
import Team from './Pages/Team';
import NewPunchItem from './Pages/NewPunchItem';
import UserSetup from './Pages/UserSetup';
import { authClient } from './auth-client';

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();
  const activeProject = location.pathname.match(/^\/projects\/([0-9a-f-]{36})(?:\/|$)/i)?.[1];

  const [isLoading, setIsLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, 1600);

    return () => window.clearTimeout(timer);
  }, []);

  if (isPending || isLoading) {
    return (
      <div className="auth-page">
        <p>Loading KonTraCk...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    );
  }

  if (
    location.pathname === '/login' ||
    location.pathname === '/signup'
  ) {
    return <Navigate to="/" replace />;
  }

  return (
    <div
      className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">K</div>

          <div className="sidebar-logo-text">
            <span>K</span>on<span>T</span>ra<span>C</span>k
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() =>
              setSidebarCollapsed(!sidebarCollapsed)
            }
            aria-label={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            title={
              sidebarCollapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="navigation">
          <Link to="/" className="nav-item" title="Home">
            <span className="nav-icon">⌂</span>
            <span>Home</span>
          </Link>

          <Link
            to="/projects"
            className="nav-item"
            title="Projects"
          >
            <span className="nav-icon">▣</span>
            <span>Projects</span>
          </Link>

          <Link
            to={activeProject ? `/projects/${activeProject}/plans` : "/projects"}
            className="nav-item"
            title="Drawings"
          >
            <span className="nav-icon">▤</span>
            <span>Drawings</span>
          </Link>

          <Link
            to={activeProject ? `/projects/${activeProject}/punch-list` : "/projects"}
            className="nav-item"
            title="Punch List"
          >
            <span className="nav-icon">✓</span>
            <span>Punch List</span>
          </Link>

          <Link to={activeProject ? `/projects/${activeProject}/team` : "/projects"} className="nav-item" title="Team">
            <span className="nav-icon">♙</span>
            <span>Team</span>
          </Link>
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-settings">
          <Link
            to="/settings"
            className="nav-item settings-nav-item"
            title="Settings"
          >
            <span className="settings-active-indicator" />
            <span className="nav-icon">⚙</span>
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-heading">
            <span className="top-bar-eyebrow">
              KONTRACK WORKSPACE
            </span>
            <h1>Project Management</h1>
          </div>

          <div className="top-user">
            <div className="top-user-avatar">
              {(
                session.user.username ||
                session.user.name ||
                'U'
              )
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>
              <strong>
                @{session.user.username || session.user.name || 'User'}
              </strong>
            </div>

            <span className="top-user-chevron">˅</span>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route
            path="/projects/:id"
            element={<ProjectDashboard />}
          />
          <Route path="/projects/:id/plans" element={<Plans />} />
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
          <Route path="/team" element={<Navigate to="/projects" replace />} />
          <Route
            path="/drawings"
            element={<Navigate to="/projects" replace />}
          />
          <Route path="/punch-list" element={<Navigate to="/projects" replace />} />
          <Route path="/settings" element={<UserSetup />} />
          <Route
            path="/test"
            element={<h1>ROUTING WORKS!</h1>}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;


import { useState } from "react";
import { authClient } from "../auth-client";
import { useNavigate } from "react-router-dom";

function UserSetup() {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [usernameInput, setUsernameInput] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setError("");
    setMessage("");
    setLoggingOut(true);

    try {
      const result = await authClient.signOut();

      if (result.error) {
        setError(result.error.message || "Could not log out.");
        return;
      }

      navigate("/login", { replace: true });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Could not log out."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  if (isPending) {
    return <div className="settings-page">Loading profile...</div>;
  }

  if (!session?.user) {
    return <div className="settings-page">Please log in to view your profile.</div>;
  }

  const name = session.user.name || "User";
  const email = session.user.email || "No email provided";
  const username =
    (session.user as typeof session.user & { username?: string }).username || "";

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const updatedName = nameInput.trim();
    const updatedUsername = usernameInput.trim();

    if (!updatedName) {
      setError("Please enter your full name.");
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(updatedUsername)) {
      setError(
        "Username must be 3–30 characters and contain only letters, numbers, or underscores."
      );
      return;
    }

    setSaving(true);

    try {
      const result = await authClient.updateUser({
        name: updatedName,
        username: updatedUsername,
      });

      if (result.error) {
        setError(
          result.error.message ||
            "Could not update your profile. The username may already be taken."
        );
        return;
      }

      setMessage("Profile updated successfully.");
      setEditing(false);
      await authClient.getSession();
    } catch (err: unknown) {
      console.error("Profile update error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Could not update your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-content">
        <div className="page-header">
          <div>
            <h2>Account Settings</h2>
            <p>Manage your personal account and preferences.</p>
          </div>
        </div>

        <div className="settings-section-header">
          <div className="settings-section-line" />
          <span>PERSONAL INFORMATION</span>
        </div>

        <div className="settings-module profile-module">
          <div className="profile-summary">
            <div className="large-profile-avatar">
              {name.charAt(0).toUpperCase()}
            </div>

            <div className="profile-identity">
              <h2>{name}</h2>
              <p className="profile-email">{email}</p>
              <p className="profile-organization">
                @{username || "username not set"}
              </p>
            </div>

            {!editing && (
              <button
                type="button"
                className="settings-button"
                onClick={() => {
                  setNameInput(name === "User" ? "" : name);
                  setUsernameInput(username);
                  setMessage("");
                  setError("");
                  setEditing(true);
                }}
              >
                Edit Profile
              </button>
            )}
          </div>

          {editing && (
            <form onSubmit={handleSave}>
              <label htmlFor="profile-name">Full name</label>
              <input
                id="profile-name"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                required
              />

              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                value={usernameInput}
                onChange={(event) => setUsernameInput(event.target.value)}
                minLength={3}
                maxLength={30}
                required
              />

              <label htmlFor="profile-email">Email address</label>
              <input id="profile-email" value={email} readOnly />

              <div>
                <button type="submit" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>

                <button
                  type="button"
                  className="settings-button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}
        </div>

        <div className="settings-section-header">
          <div className="settings-section-line" />
          <span>WORKSPACE</span>
        </div>

        <div className="settings-module">
          <div className="settings-info-row">
            <div className="settings-info">
              <span>Account</span>
              <strong>Personal</strong>
            </div>

            <div className="settings-info">
              <span>Projects</span>
              <strong>Shared by membership</strong>
            </div>

            <div className="settings-info">
              <span>Access</span>
              <strong>Account based</strong>
            </div>
          </div>

          <p className="settings-description">
            Projects can be shared with teammates through project membership.
          </p>
        </div>

        <div className="settings-section-header">
          <div className="settings-section-line" />
          <span>DEVELOPER ACCESS</span>
        </div>

        <div className="settings-module">
          <div className="settings-info-row">
            <div className="settings-info">
              <span>API Access</span>
              <strong className="api-status">
                <span className="status-dot" />
                Disabled
              </strong>
            </div>

            <div className="settings-info">
              <span>API Tokens</span>
              <strong className="large-number">0</strong>
            </div>
          </div>

          <p className="settings-description">
            Developer access and API tokens are not currently available.
          </p>
        </div>

        <div className="settings-section-header">
          <div className="settings-section-line" />
          <span>SESSION</span>
        </div>

        <div className="settings-module">
          <div className="settings-info-row">
            <div className="settings-info">
              <span>Signed in as</span>
              <strong>{email}</strong>
            </div>

            <button
              type="button"
              className="settings-button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              {loggingOut ? "Logging out..." : "Log Out"}
            </button>
          </div>

          <p className="settings-description">
            Log out of your KonTraCk account on this device.
          </p>
        </div>
      </div>
    </div>
  );
}

export default UserSetup;

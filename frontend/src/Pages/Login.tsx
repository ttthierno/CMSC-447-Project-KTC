
import { useState } from "react";
import { authClient } from "../auth-client";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Unable to sign in.");
        return;
      }

      window.location.href = "/";
   } catch (err: unknown) {
  console.error("KonTraCk sign-in error:", err);

  if (err instanceof Error) {
    setError(`Sign-in failed: ${err.message}`);
  } else {
    setError("Sign-in failed due to an unexpected error. Check the browser console.");
  }
} finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleLogin}>
        <h1>Welcome back</h1>
        <p>Welcome to KonTraCk. Sign in to continue.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p>
          Don't have an account? <a href="/signup">Create one</a>
        </p>
      </form>
    </div>
  );
}

export default Login;
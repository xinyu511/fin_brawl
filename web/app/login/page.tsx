"use client";

import { useState } from "react";
import { clearToken, login, register, setToken } from "@/lib/backendClient";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function signUp() {
    setStatus("Signing up...");
    try {
      await register(username, password);
      setStatus("Signed up! Now sign in.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Sign up failed.");
    }
  }

  async function signIn() {
    setStatus("Signing in...");
    try {
      const { token } = await login(username, password);
      setToken(token);
      setStatus("Signed in! Redirecting...");
      window.location.href = "/dashboard";
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Sign in failed.");
    }
  }

  function signOut() {
    clearToken();
    setStatus("Signed out.");
  }

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Login / Sign up</h3>
        <div className="stack">
          <input
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            placeholder="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="row">
            <button onClick={signIn}>Sign in</button>
            <button onClick={signUp}>Sign up</button>
            <button onClick={signOut}>Sign out</button>
          </div>
          <div className="muted">{status}</div>
        </div>
      </div>

      <div className="card">
        <h4 style={{ marginTop: 0 }}>Next</h4>
        <p className="muted" style={{ marginBottom: 12 }}>
          After signing in, go to the dashboard to upload receipts and chat.
        </p>
        <a href="/dashboard">
          <button>Go to Dashboard</button>
        </a>
      </div>
    </div>
  );
}

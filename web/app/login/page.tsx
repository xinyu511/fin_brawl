"use client";

import { useState } from "react";
import { login, register, setToken } from "@/lib/backendClient";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function signUp() {
    setStatus("Signing up...");
    try {
      await register(username, password);
      setStatus("Signed up! Redirecting...");
      const { token } = await login(username, password);
      setToken(token);
      window.location.href = "/dashboard";
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
            <button type="button" onClick={signIn}>Sign in</button>
            <button type="button" onClick={signUp}>Sign up</button>
          </div>
          {status && <div className="muted">{status}</div>}
        </div>
      </div>
    </div>
  );
}

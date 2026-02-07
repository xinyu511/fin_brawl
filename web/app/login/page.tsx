"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");

  async function signUp() {
    setStatus("Signing up...");
    const { error } = await supabase.auth.signUp({ email, password });
    setStatus(error ? error.message : "Signed up! If email confirmation is enabled, check your inbox.");
  }

  async function signIn() {
    setStatus("Signing in...");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Signed in! Redirecting...");
    window.location.href = "/dashboard";
  }

  async function signOut() {
    await supabase.auth.signOut();
    setStatus("Signed out.");
  }

  return (
    <div className="stack">
      <div className="card">
        <h3 style={{marginTop:0}}>Login / Sign up</h3>
        <div className="stack">
          <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <div className="row">
            <button onClick={signIn}>Sign in</button>
            <button onClick={signUp}>Sign up</button>
            <button onClick={signOut}>Sign out</button>
          </div>
          <div className="muted">{status}</div>
        </div>
      </div>

      <div className="card">
        <h4 style={{marginTop:0}}>Next</h4>
        <p className="muted" style={{marginBottom:12}}>
          After signing in, go to the dashboard to upload receipts and chat.
        </p>
        <a href="/dashboard"><button>Go to Dashboard</button></a>
      </div>
    </div>
  );
}

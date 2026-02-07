"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function BodyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  if (isDashboard) {
    return <div className="page page--dashboard">{children}</div>;
  }


  return (
    <div className="container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
        }}
      >
        <a href="/" style={{ textDecoration: "none" }}>
          <h2 style={{ margin: 0 }}>Budget Agent</h2>
        </a>
        <div className="muted" style={{ fontSize: 13 }}>
          Next.js • Supabase • OpenAI
        </div>
      </div>
      {children}
    </div>
  );
}

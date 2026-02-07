"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function BodyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isDashboard =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/advising");
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
        <Link href="/" style={{ textDecoration: "none" }}>
          <h2 className="brand-font" style={{ margin: 0, fontSize: 32 }}>PiggyAI</h2>
        </Link>
        <div className="muted" style={{ fontSize: 13 }}>
          Next.js • Supabase • OpenAI
        </div>
      </div>
      {children}
    </div>
  );
}

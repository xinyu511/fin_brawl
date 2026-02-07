import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Budget Agent",
  description: "Budget-tracking LLM website scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom: 16}}>
            <a href="/" style={{textDecoration:"none"}}><h2 style={{margin:0}}>Budget Agent</h2></a>
            <div className="muted" style={{fontSize: 13}}>Next.js • Supabase • OpenAI</div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}

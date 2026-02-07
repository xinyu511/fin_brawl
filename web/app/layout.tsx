import "./globals.css";
import type { Metadata } from "next";
import BodyShell from "./BodyShell";

export const metadata: Metadata = {
  title: "Budget Agent",
  description: "Budget-tracking LLM website scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <BodyShell>{children}</BodyShell>
      </body>
    </html>
  );
}

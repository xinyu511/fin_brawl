import "./globals.css";
import type { Metadata } from "next";
import { Baloo_2 } from "next/font/google";

const baloo = Baloo_2({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-bubble",
});
import BodyShell from "./BodyShell";

export const metadata: Metadata = {
  title: "Budget Agent",
  description: "Budget-tracking LLM website scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={baloo.variable}>
      <body>
        <BodyShell>{children}</BodyShell>
      </body>
    </html>
  );
}

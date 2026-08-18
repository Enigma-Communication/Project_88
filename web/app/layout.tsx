import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project 88 — Illustration Generator",
  description: "Turn a match photo into a screenprint illustration.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * The two Google faces the boards use alongside the licensed pair.
 *
 * Archivo carries the example captions and a few chip descriptions; IBM Plex
 * Mono carries the "on paper" sub-captions and the numeric readouts. Both are
 * self-hosted by next/font at build time, so there is no request to Google at
 * runtime and no layout shift.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "900"],
  variable: "--font-archivo",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Project 88 — Illustration Generator",
  description: "Turn a match photo into an accent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

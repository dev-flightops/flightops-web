import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import "./globals.css";

// Inter for UI, JetBrains Mono for codes (flight numbers, ICAO airports,
// tail numbers). Matches the legacy dispatch-platform's typography choice.
// Variable approach so Tailwind can resolve `font-sans` and `font-mono`.
const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Peregrine FlightOps",
  description: "Multi-tenant Part 135 aviation dispatch and operations platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      // No `dark` here any more. The page ground is the home page's light
      // theme; dark is an ink island a surface opts into (see globals.css).
      className={`${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

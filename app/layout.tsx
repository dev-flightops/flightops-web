import type { Metadata } from "next";
import { Barlow_Semi_Condensed, Figtree, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { THEME_COOKIE, themeFromCookie } from "@/lib/theme/theme-mode";

import "./globals.css";

// Type (#78), ForeFlight's system on open-licence faces. ForeFlight sets
// Proxima Nova and Gesta, both commercial; Figtree is the nearest open
// geometric sans (with tabular figures, which the boards' times need) and
// Barlow Semi Condensed the nearest to Gesta's heavy uppercase. Each is one
// CSS variable, so licensed originals can replace them in one place.
// JetBrains Mono stays for codes: flight numbers, ICAO airports, tails.
const fontSans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const fontDisplay = Barlow_Semi_Condensed({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["600", "700", "800"],
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Dark unless the user chose light; read here so the first byte is right.
  const theme = themeFromCookie((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen bg-background text-foreground font-sans antialiased">
        <ThemeProvider initial={theme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}

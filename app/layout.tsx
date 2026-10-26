import type { Metadata } from "next";
import localFont from "next/font/local";
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
//
// The files are in app/fonts (#116, how they were cut is in its README):
// builds used to download them from Google Fonts, and now and then failed
// to. The weights are the ones we had from Google. Mono stays at 400-500:
// a wider range would change how bold codes are drawn.
const fontSans = localFont({
  src: "./fonts/figtree.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400 800",
});

const fontDisplay = localFont({
  src: [
    { path: "./fonts/barlow-semi-condensed-600.woff2", weight: "600" },
    { path: "./fonts/barlow-semi-condensed-700.woff2", weight: "700" },
    { path: "./fonts/barlow-semi-condensed-800.woff2", weight: "800" },
  ],
  variable: "--font-display",
  display: "swap",
});

const fontMono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "400 500",
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

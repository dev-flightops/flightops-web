import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // reactStrictMode is off while we're on React 18 + react-leaflet 4.2.1.
  // v4 has a known bug where MapContainer's cleanup doesn't reset
  // Leaflet's `_leaflet_id` on its container div, so the strict-mode
  // double-mount throws "Map container is already initialized" and
  // blocks /flight-following entirely in dev. react-leaflet 5 fixes
  // the lifecycle but requires React 19. Re-enable strict mode in the
  // same change as the React 19 upgrade (tracked for M3 maintenance).
  // Strict mode is a dev-only check — production builds are unaffected.
  reactStrictMode: false,
  // Legacy URLs are mixed: app pages use a trailing slash (`/home/`,
  // `/dispatch/`) but `/login` does not. Next.js's `trailingSlash` setting
  // is binary, so we disable its auto-redirect entirely and let internal
  // Links + the proxy middleware pick the canonical form per-route.
  skipTrailingSlashRedirect: true,
  experimental: {
    // Uploads (documents, employee documents, ramp photos) are server
    // actions. Next's default 1 MB refused most phone photos and scanned
    // PDFs. Vercel caps a request at 4.5 MB anyway (4 MB through
    // proxy.ts), so the forms hold files to 3.8 MB (lib/upload-limits.ts).
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;

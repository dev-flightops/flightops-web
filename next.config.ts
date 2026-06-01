import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Legacy URLs are mixed: app pages use a trailing slash (`/home/`,
  // `/dispatch/`) but `/login` does not. Next.js's `trailingSlash` setting
  // is binary, so we disable its auto-redirect entirely and let internal
  // Links + the proxy middleware pick the canonical form per-route.
  skipTrailingSlashRedirect: true,
};

export default nextConfig;

import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Vercel Deployment Protection sits in front of preview URLs and 302s
// every unauthenticated request to a Vercel SSO screen. To let CI reach
// the actual app, set VERCEL_AUTOMATION_BYPASS_SECRET (in the Vercel
// project's "Protection Bypass for Automation" section) as a GH secret
// and pass it in. When unset (local runs / prod URL), the header is
// simply omitted.
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
const extraHTTPHeaders = vercelBypass
  ? { "x-vercel-protection-bypass": vercelBypass }
  : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  // Vercel Deployment Protection bypass is handled inside the auth
  // fixture (tests/e2e/fixtures/auth.ts → primeVercelBypass) — done in
  // the same browser context that runs the login, so no cross-context
  // cookie-transfer race. When VERCEL_AUTOMATION_BYPASS_SECRET is
  // unset, primeVercelBypass no-ops.
  use: {
    baseURL,
    extraHTTPHeaders,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});

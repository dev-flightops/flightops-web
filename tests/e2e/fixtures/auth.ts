/**
 * Playwright fixture that signs in once per worker and reuses the session
 * across tests via storageState. The auth cookies are saved to a worker-local
 * JSON file, so adding more authenticated specs doesn't multiply login round
 * trips against the backend.
 *
 * Usage:
 *   import { test, expect } from "./fixtures/auth";
 *   test("...", async ({ loggedInPage }) => { ... });
 *
 * Local: requires `docker compose up + npm run dev`.
 * CI:    reads E2E_BASE_URL (a Vercel preview) + optional
 *        VERCEL_AUTOMATION_BYPASS_SECRET (Vercel Protection Bypass for
 *        Automation). When the secret is set, the fixture performs a
 *        one-time bypass visit BEFORE calling `performLogin` so the
 *        _vercel_jwt cookie is set on the exact context the login
 *        will run against.
 *
 * Running multiple auth-fixture specs in parallel occasionally flakes on
 * Auth.js cookie contention. Run with `--workers=1` for stability.
 */

import { test as base, expect, type Page, type BrowserContext } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const DEMO_EMAIL = "admin@flightops.local";
const DEMO_PASSWORD = "flightops-dev";

const storageRoot = join(tmpdir(), "flightops-e2e-auth");
mkdirSync(storageRoot, { recursive: true });

/**
 * If we're targeting a Vercel preview URL that has Deployment
 * Protection enabled, land the browser on
 *   <base>/?x-vercel-set-bypass-cookie=samesitenone
 *          &x-vercel-protection-bypass=<secret>
 * FIRST. Vercel's edge sets a _vercel_jwt cookie on the preview
 * host that all subsequent requests reuse, so `/login` doesn't 302
 * to vercel.com/sso-api. No-op when the secret or base URL is
 * missing (local dev).
 *
 * The check for the cookie's presence is the real signal that the
 * secret is correct — a mismatched secret silently returns a normal
 * SSO redirect and never sets the cookie.
 */
async function primeVercelBypass(context: BrowserContext): Promise<void> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseURL = process.env.E2E_BASE_URL;
  if (!secret || !baseURL) return;

  const url = new URL(baseURL);
  url.searchParams.set("x-vercel-set-bypass-cookie", "samesitenone");
  url.searchParams.set("x-vercel-protection-bypass", secret);

  const page = await context.newPage();
  try {
    await page.goto(url.toString(), { waitUntil: "load", timeout: 30_000 });
  } catch {
    // The destination may 302 / 404 / etc.; what we care about is
    // whether the cookie landed. Fall through.
  }
  const cookies = await context.cookies();
  const hasBypass = cookies.some((c) => c.name === "_vercel_jwt");
  await page.close();
  if (!hasBypass) {
    throw new Error(
      "Vercel bypass: no _vercel_jwt cookie was set after the bypass " +
        "visit. The VERCEL_AUTOMATION_BYPASS_SECRET GH secret probably " +
        "doesn't match the value in Vercel → Project Settings → " +
        "Deployment Protection → Protection Bypass for Automation.",
    );
  }
}

async function performLogin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  // Anchored regex — "Sign In" (credentials) not "Sign in with Google" etc.
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL((url) => !/\/login/.test(url.pathname));
}

export const test = base.extend<{ loggedInPage: Page }>({
  loggedInPage: async ({ browser }, use, testInfo) => {
    const storageFile = join(
      storageRoot,
      `worker-${testInfo.parallelIndex}.json`,
    );

    // First test in a worker: log in and persist cookies. Subsequent tests
    // reuse them via storageState. The bypass cookie is captured in the
    // same storageState so downstream contexts inherit it too.
    let context = await browser.newContext();
    try {
      await primeVercelBypass(context);
      const page = await context.newPage();
      await performLogin(page);
      await page.close();
      await context.storageState({ path: storageFile });
    } finally {
      await context.close();
    }

    context = await browser.newContext({ storageState: storageFile });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

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
 * Requires the local stack to be running (docker compose up + npm run dev).
 * These specs are local/pre-merge, not CI.
 *
 * Running multiple auth-fixture specs in parallel occasionally flakes on
 * Auth.js cookie contention (different workers logging in at once against
 * a single Next.js dev server). Run with `--workers=1` for a stable pass:
 *   npx playwright test --workers=1
 */

import { test as base, expect, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Written by tests/e2e/global-setup.ts when
// VERCEL_AUTOMATION_BYPASS_SECRET is set — contains the _vercel_jwt
// cookie that Vercel Deployment Protection accepts. Empty when running
// against localhost.
const vercelBypassStatePath = resolve(
  __dirname,
  "..",
  ".vercel-bypass-state.json",
);

function loadVercelBypassState():
  | { cookies?: unknown[]; origins?: unknown[] }
  | undefined {
  if (!existsSync(vercelBypassStatePath)) return undefined;
  try {
    const state = JSON.parse(readFileSync(vercelBypassStatePath, "utf-8"));
    if (Array.isArray(state.cookies) && state.cookies.length === 0) {
      return undefined;
    }
    return state;
  } catch {
    return undefined;
  }
}

const DEMO_EMAIL = "admin@flightops.local";
const DEMO_PASSWORD = "flightops-dev";

const storageRoot = join(tmpdir(), "flightops-e2e-auth");
mkdirSync(storageRoot, { recursive: true });

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

    // Seed the login-context with the Vercel bypass cookie if global
    // setup produced one; otherwise start clean.
    const bypassState = loadVercelBypassState();

    // First test in a worker: log in and persist cookies. Subsequent tests
    // reuse them.
    let context = await browser.newContext(
      bypassState ? { storageState: bypassState as never } : undefined,
    );
    let page = await context.newPage();
    try {
      await performLogin(page);
      await context.storageState({ path: storageFile });
    } finally {
      await context.close();
    }

    context = await browser.newContext({ storageState: storageFile });
    page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };

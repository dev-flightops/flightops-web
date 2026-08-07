/**
 * Playwright global setup — runs once before any test.
 *
 * When targeting a Vercel preview URL that has Deployment Protection
 * enabled, the browser must have a `_vercel_jwt` cookie to bypass the
 * SSO redirect. Vercel sets this cookie for the session when you visit
 *   <preview>/?x-vercel-set-bypass-cookie=true
 *          &x-vercel-protection-bypass=<secret>
 *
 * We do that one-time visit here and persist the cookie into
 * tests/e2e/.vercel-bypass-state.json, which auth fixtures then reuse
 * via storageState. Without this, every subsequent Playwright request
 * eats a 302 to vercel.com/sso-api and the tests time out at 30s
 * looking for app elements that never render.
 *
 * Skipped cleanly when VERCEL_AUTOMATION_BYPASS_SECRET is unset — that
 * means we're running against localhost or a URL with no protection.
 */

import { chromium, request } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const VERCEL_BYPASS_STATE_PATH = resolve(
  __dirname,
  ".vercel-bypass-state.json",
);

export default async function globalSetup(): Promise<void> {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseURL = process.env.E2E_BASE_URL;

  if (!secret || !baseURL) {
    // Nothing to do — write an empty state file so the fixtures can
    // always load it without a conditional.
    mkdirSync(dirname(VERCEL_BYPASS_STATE_PATH), { recursive: true });
    writeFileSync(VERCEL_BYPASS_STATE_PATH, JSON.stringify({ cookies: [], origins: [] }));
    return;
  }

  const url = new URL(baseURL);
  // "samesitenone" is more reliable across Vercel's SSO redirect chain
  // than "true" — the resulting cookie has SameSite=None so it's sent
  // on the cross-origin bounce back to the preview host.
  url.searchParams.set("x-vercel-set-bypass-cookie", "samesitenone");
  url.searchParams.set("x-vercel-protection-bypass", secret);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Don't assert on response status — the bypass URL 302s through
  // Vercel's edge, then hits the app, and the app's own middleware
  // may return a redirect / 404 depending on the path. What matters
  // is whether the `_vercel_jwt` cookie landed. Ignore load failures.
  try {
    await page.goto(url.toString(), { waitUntil: "load", timeout: 30_000 });
  } catch {
    // Continue — the cookie may still be set even if load timed out.
  }

  const cookies = await context.cookies();
  const bypassCookie = cookies.find((c) => c.name === "_vercel_jwt");
  if (!bypassCookie) {
    throw new Error(
      "Vercel bypass: no _vercel_jwt cookie was set — the " +
        "VERCEL_AUTOMATION_BYPASS_SECRET GH secret probably doesn't " +
        "match the Vercel project's 'Protection Bypass for Automation' " +
        "secret. Regenerate on Vercel side and copy the new value into " +
        "the GH secret.",
    );
  }

  await context.storageState({ path: VERCEL_BYPASS_STATE_PATH });
  await browser.close();

  // Silence "unused" lint — reserved for future direct-API bypass.
  void request;
}

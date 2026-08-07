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
  url.searchParams.set("x-vercel-set-bypass-cookie", "true");
  url.searchParams.set("x-vercel-protection-bypass", secret);

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const response = await page.goto(url.toString(), { waitUntil: "load" });
  if (!response) {
    throw new Error("Vercel bypass: no response from preview URL");
  }
  if (response.status() >= 400) {
    throw new Error(
      `Vercel bypass: preview URL returned ${response.status()} — ` +
        "check VERCEL_AUTOMATION_BYPASS_SECRET matches the Vercel " +
        "project's 'Protection Bypass for Automation' secret exactly.",
    );
  }
  // Persist the _vercel_jwt cookie the visit above just set.
  await context.storageState({ path: VERCEL_BYPASS_STATE_PATH });
  await browser.close();

  // Silence "unused" lint in an env where request is future-proofing.
  void request;
}

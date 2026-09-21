import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * No server action may report success without persisting anything.
 *
 * The global red Safety button was backed by `fileSafetyReportAction`,
 * a stub written in M2 that appended the filing to `.safety-reports.log`
 * and returned `{status: "ok"}`. Its own docstring said to swap the file
 * append for an apiFetch POST "when safety-service lands". safety-service
 * landed in M3 with a working `POST /safety/hazards` — and the action was
 * never rewired. For two milestones every safety report filed from the
 * button on every page was written to a local file, or on Vercel, where
 * the filesystem is read-only, to stdout. The reporter was told
 * "Report filed"; the Safety Officer never saw it; /safety/mine, which
 * reads the real API, told the reporter to use that very button and then
 * showed them nothing.
 *
 * Nothing failed. No test covered the action, the UI path returned the
 * same success shape it always had, and the caveat in the dialog still
 * read "Safety-service lands in M3" long after M3 shipped. A stub is
 * only safe while somebody remembers it is a stub, so this test is the
 * thing that remembers.
 *
 * The heuristic is deliberately blunt: an action that can return a
 * success status but contains no reference to the API layer. That
 * catches the honest mistake — a stub outliving its backend — without
 * needing to understand control flow.
 *
 * Legitimate exceptions exist (an action that only sets a cookie, or
 * builds a file in-process). The allowlist below is how they are
 * declared. It is empty, and the point is that adding to it is a
 * deliberate act with a reason attached, rather than a stub quietly
 * ageing into a lie.
 */

/** path -> why this action can honestly succeed without the API. */
const ALLOWED_WITHOUT_API: Record<string, string> = {};

const SUCCESS_SHAPES = [/status:\s*"ok"/, /status:\s*"success"/];

/**
 * Comments are stripped before matching, and that is not a nicety. The
 * safety stub's own docstring read "swap the file append + console for
 * an apiFetch POST to /safety/reports" — so scanning the raw source for
 * `apiFetch` found the word in the note explaining that the call was
 * missing, and cleared the file. The prose describing the absence
 * looked exactly like the presence.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function serverActionFiles(): { path: string; source: string }[] {
  const found: { path: string; source: string }[] = [];
  for (const dir of ["app", "components", "lib"]) {
    for (const path of walk(dir)) {
      const raw = readFileSync(path, "utf8");
      if (!/^\s*["']use server["']/m.test(raw)) continue;
      found.push({ path, source: stripComments(raw) });
    }
  }
  return found;
}

describe("server actions", () => {
  const files = serverActionFiles();

  it("finds the server actions to check", () => {
    // Guards the walk itself: a broken path or changed directive style
    // would otherwise make every assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(40);
  });

  it("never report success without reaching the API", () => {
    const faking: string[] = [];

    for (const { path, source } of files) {
      if (!SUCCESS_SHAPES.some((re) => re.test(source))) continue;
      if (/apiFetch|@\/lib\/api/.test(source)) continue;
      if (path in ALLOWED_WITHOUT_API) continue;
      faking.push(path);
    }

    expect(faking).toEqual([]);
  });

  it("allowlists only actions that still exist", () => {
    const paths = new Set(files.map((f) => f.path));
    const stale = Object.keys(ALLOWED_WITHOUT_API).filter(
      (p) => !paths.has(p),
    );
    expect(stale).toEqual([]);
  });
});

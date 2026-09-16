import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import tailwindConfig from "@/tailwind.config";

/**
 * Every `status-*` colour used anywhere in the app must exist in the
 * Tailwind config.
 *
 * WHY THIS IS REPO-WIDE AND NOT PER-FILE
 *
 * `app/(app)/fleetbrain/badge-palette.test.ts` already guards this, for
 * the two maps in one component. It was written after
 * `text-status-amber` shipped into FleetBrain's badge map — this app's
 * token is `status-yellow` and there is no `amber`, so Tailwind
 * generated nothing, the class was applied and did precisely nothing,
 * and the badge rendered unstyled with every test still green.
 *
 * Then `text-status-amber` shipped again, in the schedule export's
 * count cards and its inferred-frequency marker. Same mistake, a
 * different file, and the existing guard could not see it because it
 * imports two specific maps. A page rendered a figure it meant to flag
 * in ordinary white, and the only thing that caught it was reading the
 * computed colour in a browser.
 *
 * So the scan is over the source, not over an imported map. Anything
 * of the form `text-status-x` / `bg-status-x/10` / `border-status-x`
 * in any component has to name a token that exists.
 *
 * A class string is invisible to the type system and silent at
 * runtime: a wrong token is not an error anywhere, it is an absence of
 * styling. That is exactly the kind of defect a test has to be pointed
 * at deliberately.
 */

const ROOTS = ["app", "components", "lib"];

/** Tailwind utility prefixes that can take a colour token. Anchoring
 *  on these keeps identifiers like `status-filter` and prose like
 *  "status-driven" out of the scan. */
const UTILITY =
  "(?:text|bg|border|ring|outline|fill|stroke|decoration|shadow|from|via|to|accent|caret|divide|placeholder)";

const USAGE = new RegExp(`\\b${UTILITY}-status-([a-z]+)`, "g");

const theme = tailwindConfig.theme?.extend?.colors as
  | Record<string, unknown>
  | undefined;

const DEFINED = new Set(
  Object.keys((theme?.status ?? {}) as Record<string, string>),
);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

interface Usage {
  token: string;
  file: string;
}

function allUsages(): Usage[] {
  const found: Usage[] = [];
  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      // Skip this file and the FleetBrain guard: both quote bad tokens
      // on purpose, in prose, to say what went wrong.
      if (file.endsWith("palette-tokens.test.ts")) continue;
      if (file.endsWith("badge-palette.test.ts")) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(USAGE)) {
        found.push({ token: match[1], file });
      }
    }
  }
  return found;
}

describe("the status palette", () => {
  it("defines the tokens the config is expected to have", () => {
    // If a token is renamed the list below should be updated
    // deliberately, not silently.
    expect([...DEFINED].sort()).toEqual([
      "blue",
      "gray",
      "green",
      "orange",
      "purple",
      "red",
      "teal",
      "yellow",
    ]);
  });

  it("is never asked for a colour it does not define", () => {
    const unknown = allUsages().filter((u) => !DEFINED.has(u.token));
    const report = [
      ...new Set(unknown.map((u) => `${u.file}: status-${u.token}`)),
    ].sort();
    expect(
      report,
      "Tailwind emits nothing for an unknown token, so these classes " +
        "are applied and do nothing. `amber` is the usual one — this " +
        "app's token is `yellow`.",
    ).toEqual([]);
  });

  it("catches a bad token when one is introduced", () => {
    // The guard's own guard: proves the regex matches the shape that
    // went wrong, rather than passing because it matches nothing.
    const sample =
      'className="mt-1 text-status-amber" and "bg-status-yellow/10"';
    const tokens = [...sample.matchAll(USAGE)].map((m) => m[1]);
    expect(tokens).toEqual(["amber", "yellow"]);
    expect(tokens.filter((t) => !DEFINED.has(t))).toEqual(["amber"]);
  });

  it("ignores identifiers and prose that merely contain the word", () => {
    const sample = "const statusFilter = 1; // status-driven, status-tokens";
    expect([...sample.matchAll(USAGE)]).toEqual([]);
  });
});

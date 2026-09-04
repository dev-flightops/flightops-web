import { describe, expect, it } from "vitest";

import tailwindConfig from "@/tailwind.config";

import { BADGE_CLASS, CELL_TONE } from "./fleetbrain-transcript";

/**
 * Every colour these two tables reach for must exist in the Tailwind
 * config.
 *
 * Written after shipping `text-status-amber` into the badge map. This
 * app's palette has `status-yellow`; there is no `amber`. Tailwind
 * generates nothing for a token it does not know, so the class string
 * was emitted, applied, and did precisely nothing — the badge rendered
 * unstyled and every test still passed, because they only asserted the
 * red and green rows.
 *
 * Asserting the class *string* is what let that through. This asserts
 * the token instead, against the config that defines it, so a colour
 * that does not exist fails here rather than on a screen.
 */

const theme = tailwindConfig.theme?.extend?.colors as
  | Record<string, unknown>
  | undefined;

const STATUS_TOKENS = new Set(
  Object.keys((theme?.status ?? {}) as Record<string, string>),
);

/** Tokens defined outside the `status` group that these maps use. */
const OTHER_TOKENS = new Set(["border", "muted", "muted-foreground"]);

/** Pull `status-x` out of `bg-status-x/10`, `text-status-x`, etc. */
function statusTokensIn(classes: string): string[] {
  return [...classes.matchAll(/status-([a-z]+)/g)].map((m) => m[1]);
}

function nonStatusTokensIn(classes: string): string[] {
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .filter((c) => !c.includes("status-"))
    // Utilities that carry no colour token.
    .filter((c) => !/^(font-semibold|line-through)$/.test(c))
    .map((c) => c.replace(/^(bg|text|border)-/, "").replace(/\/\d+$/, ""));
}

describe("the Tailwind config is the source of truth", () => {
  it("defines the status group at all", () => {
    // Guards the guard: if the config shape moves, every assertion
    // below would pass vacuously against an empty set.
    expect(STATUS_TOKENS.size).toBeGreaterThan(5);
    expect(STATUS_TOKENS.has("yellow")).toBe(true);
    expect(STATUS_TOKENS.has("amber")).toBe(false);
  });
});

describe("badge colours", () => {
  it("covers every colour the service can send", () => {
    // The service's Badge.color literal. A new colour there must land
    // here, or it falls through to grey silently.
    expect(Object.keys(BADGE_CLASS).sort()).toEqual(
      ["amber", "blue", "green", "grey", "red"].sort(),
    );
  });

  it.each(Object.entries(BADGE_CLASS))(
    "%s maps only to tokens that exist",
    (_color, classes) => {
      for (const token of statusTokensIn(classes)) {
        expect(STATUS_TOKENS).toContain(token);
      }
      for (const token of nonStatusTokensIn(classes)) {
        expect(OTHER_TOKENS).toContain(token);
      }
    },
  );

  it("gives each colour a visibly different class", () => {
    // Two colours resolving to the same classes would render the same
    // badge, which is worse than no colour at all.
    const values = Object.values(BADGE_CLASS);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("table cell colours", () => {
  it.each(Object.entries(CELL_TONE))(
    "%s maps only to tokens that exist",
    (_value, classes) => {
      for (const token of statusTokensIn(classes)) {
        expect(STATUS_TOKENS).toContain(token);
      }
      for (const token of nonStatusTokensIn(classes)) {
        expect(OTHER_TOKENS).toContain(token);
      }
    },
  );
});

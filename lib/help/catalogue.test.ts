import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEPARTMENTS } from "@/components/app-shell/modules";

import {
  HELP_ENTRIES,
  helpFor,
  searchHelp,
} from "./catalogue";

/**
 * The help catalogue.
 *
 * Two kinds of check here. The resolution and search rules, which are
 * ordinary logic; and the freshness ones, which exist because help
 * content rots in exactly the way the nav does — an article about a
 * page that no longer exists, or one whose route was renamed, reads as
 * authoritative and is wrong.
 *
 * That is the same failure this session found eleven times in the nav,
 * so the guard is here from the start rather than after a screenshot.
 */

const APP_DIR = "app/(app)";

function hasPage(route: string): boolean {
  const path = route.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  return existsSync(join(APP_DIR, path, "page.tsx"));
}

describe("the catalogue stays honest", () => {
  it("has entries to check", () => {
    // Guards the guard: an empty catalogue passes everything below.
    expect(HELP_ENTRIES.length).toBeGreaterThanOrEqual(10);
  });

  it("never documents a route with no page", () => {
    // An article about a page that does not exist reads as
    // authoritative and sends the reader to a 404.
    const orphans = HELP_ENTRIES.filter((e) => !hasPage(e.route)).map(
      (e) => `${e.title} -> ${e.route}`,
    );
    expect(orphans, "help articles for routes with no page").toEqual([]);
  });

  it("never links a related route with no page", () => {
    const broken: string[] = [];
    for (const entry of HELP_ENTRIES) {
      for (const route of entry.related ?? []) {
        if (!hasPage(route)) broken.push(`${entry.title} -> ${route}`);
      }
    }
    expect(broken, "related links pointing at no page").toEqual([]);
  });

  it("can name every related route it links", () => {
    // Related links are navigation, not article links — landing on the
    // Weather page is useful whether or not somebody has written about
    // it. But the panel has to be able to LABEL them, and it does that
    // from the article if there is one and the nav registry otherwise.
    // A route in neither would render as a raw path.
    const navRoutes = new Set(
      DEPARTMENTS.flatMap((d) => d.children)
        .map((c) => c.href)
        .filter((h): h is string => Boolean(h)),
    );
    const articled = new Set(HELP_ENTRIES.map((e) => e.route));
    const unnameable: string[] = [];
    for (const entry of HELP_ENTRIES) {
      for (const route of entry.related ?? []) {
        if (!articled.has(route) && !navRoutes.has(route)) {
          unnameable.push(`${entry.title} -> ${route}`);
        }
      }
    }
    expect(
      unnameable,
      "related links with neither an article nor a nav label",
    ).toEqual([]);
  });

  it("has no duplicate routes", () => {
    const routes = HELP_ENTRIES.map((e) => e.route);
    expect(routes).toEqual([...new Set(routes)]);
  });

  it("gives every entry a body worth reading", () => {
    // A stub article is worse than none: it reads like help and
    // contains nothing, and the panel's honest "not written yet" state
    // is the better answer.
    const thin = HELP_ENTRIES.filter(
      (e) => e.whatItDoes.length < 60 || e.howToUse.length < 2,
    ).map((e) => e.title);
    expect(thin, "these entries are too thin to be useful").toEqual([]);
  });

  it("documents pages the nav actually offers", () => {
    // Cross-check against the module registry rather than the
    // filesystem alone: a page that exists but is not reachable is not
    // worth an article, and one the nav offers is.
    const navRoutes = new Set(
      DEPARTMENTS.flatMap((d) => d.children)
        .map((c) => c.href)
        .filter((h): h is string => Boolean(h)),
    );
    const unreachable = HELP_ENTRIES.filter(
      (e) => !navRoutes.has(e.route) && !hasPage(e.route),
    ).map((e) => e.route);
    expect(unreachable).toEqual([]);
  });
});

describe("helpFor", () => {
  it("finds the article for an exact route", () => {
    expect(helpFor("/reports/bi")?.title).toBe("Business Intelligence");
  });

  it("falls back to the nearest parent", () => {
    // /reports/regulatory/t100 has no article of its own, and the
    // regulatory one covers it.
    expect(helpFor("/reports/regulatory/t100")?.title).toBe(
      "Regulatory returns",
    );
  });

  it("prefers the most specific article", () => {
    // Both /reports and /reports/bi match; the longer one wins, or
    // every report page would get the hub's article.
    expect(helpFor("/reports/bi")?.route).toBe("/reports/bi");
    expect(helpFor("/reports/executive/summary")?.route).toBe("/reports");
  });

  it("does not match a route that merely shares a prefix string", () => {
    // "/reports-archive" starts with "/reports" as a string but is not
    // under it as a path.
    expect(helpFor("/reports-archive")).toBeNull();
  });

  it("returns null for a page with no article", () => {
    expect(helpFor("/housing")).toBeNull();
  });
});

describe("searchHelp", () => {
  it("ignores a query too short to mean anything", () => {
    expect(searchHelp("a")).toEqual([]);
    expect(searchHelp(" ")).toEqual([]);
  });

  it("matches a title", () => {
    expect(searchHelp("profitability").map((e) => e.route)).toContain(
      "/profitability",
    );
  });

  it("matches body text", () => {
    // "carrier code" appears in the schedule export's body, not its
    // title.
    expect(searchHelp("carrier code").map((e) => e.route)).toContain(
      "/reports/sim",
    );
  });

  it("ranks a title match above a body match", () => {
    // Somebody typing "reports" wants the Reports article, not the
    // first article that happens to mention reports.
    //
    // This assertion used "dispatch" first, which does not
    // discriminate: with flat scoring the alphabetical tie-break puts
    // Dispatch first anyway, so a mutation that removed the title
    // weighting passed. "reports" and "settings" both separate the
    // two — under flat scoring these would lead with Business
    // Intelligence and Flight Following respectively.
    expect(searchHelp("reports")[0].title).toBe("Reports");
    expect(searchHelp("settings")[0].title).toBe("Settings");
  });

  it("is case insensitive", () => {
    expect(searchHelp("MANIFEST").length).toBe(searchHelp("manifest").length);
  });

  it("returns nothing for a word nobody wrote", () => {
    expect(searchHelp("zzzqqq")).toEqual([]);
  });
});

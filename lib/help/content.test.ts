import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { HELP_ENTRIES } from "./catalogue";
import { helpCorpus } from "./corpus";
import { FAQ } from "./faq";
import { GUIDES } from "./guides";
import { WORKFLOW } from "./workflow";

/**
 * The guides, FAQ and workflow on /help, and the text the help
 * assistant answers from (#114).
 *
 * Help that names a page that isn't there, or an anchor that goes
 * nowhere, reads as authoritative and is wrong; the assistant repeats
 * it. So the same freshness checks as the catalogue's, over every link
 * in the new content, and the corpus held to being the same bytes from
 * the same content: it is hashed, cached and uploaded by that hash.
 */

const APP_DIR = "app/(app)";
const LINK = /\]\(([^)\s]+)\)/g;

function hasPage(route: string): boolean {
  const path = route.split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  return existsSync(join(APP_DIR, path, "page.tsx"));
}

const ANCHORS = new Set([
  "workflow",
  ...WORKFLOW.map((s) => `workflow-${s.slug}`),
  ...GUIDES.map((g) => `guide-${g.slug}`),
  ...FAQ.map((f) => `faq-${f.slug}`),
]);

const TEXTS: Array<[string, string]> = [
  ...WORKFLOW.map((s): [string, string] => [`workflow ${s.slug}`, s.what]),
  ...GUIDES.flatMap((g) =>
    [g.summary, ...g.steps, ...(g.notes ?? [])].map((t): [string, string] => [`guide ${g.slug}`, t]),
  ),
  ...FAQ.flatMap((f) =>
    [f.answer, ...(f.points ?? [])].map((t): [string, string] => [`faq ${f.slug}`, t]),
  ),
];

describe("the help content stays honest", () => {
  it("has the three the client asked for by name", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(slugs).toEqual(
      expect.arrayContaining(["release-a-flight", "file-a-frat", "write-up-a-squawk"]),
    );
    expect(FAQ[0].question).toBe("Why won't my flight release?");
    expect(WORKFLOW[0].slug).toBe("booking");
    expect(WORKFLOW[WORKFLOW.length - 1].slug).toBe("invoice");
  });

  it("links only to pages that exist and anchors that exist", () => {
    const broken: string[] = [];
    for (const [where, text] of TEXTS) {
      for (const [, href] of text.matchAll(LINK)) {
        if (!href.startsWith("/")) broken.push(`${where}: ${href} (not a page here)`);
        else if (href.startsWith("/help#")) {
          if (!ANCHORS.has(href.slice("/help#".length))) broken.push(`${where}: ${href}`);
        } else if (!hasPage(href)) broken.push(`${where}: ${href}`);
      }
    }
    const pages = [
      ...WORKFLOW.map((s) => s.page),
      ...GUIDES.flatMap((g) => g.pages),
      ...FAQ.flatMap((f) => f.pages),
    ];
    for (const page of pages) if (!hasPage(page)) broken.push(`page ${page}`);
    expect(broken, "help links that go nowhere").toEqual([]);
  });

  it("has no duplicate anchors", () => {
    const all = [...GUIDES.map((g) => g.slug), ...FAQ.map((f) => f.slug), ...WORKFLOW.map((s) => s.slug)];
    expect(new Set(all).size).toBe(all.length);
  });

  it("gives every guide steps to follow and someone to follow them", () => {
    for (const guide of GUIDES) {
      expect(guide.steps.length, guide.slug).toBeGreaterThanOrEqual(3);
      expect(guide.roles.length, guide.slug).toBeGreaterThan(0);
    }
  });

  it("explains every refusal the release gives", () => {
    // The packet's own words (dispatch/[flightId]/actions.ts): a refusal
    // missing here is one the assistant can't explain.
    const answer = FAQ[0].points!.join("\n");
    for (const words of [
      "already been released",
      "not active",
      "not airworthy",
      "no PIC",
      "PIC changed",
      "hard-block currency items",
      "supervisor override",
      "currency warnings",
      "135.265",
      "NOTAMs not acknowledged",
      "dispatch minimums",
      "stale or missing weather",
      "roster",
    ]) {
      expect(answer, words).toContain(words);
    }
  });
});

describe("the assistant's text", () => {
  const corpus = helpCorpus();

  it("is the same bytes every time", () => {
    const hash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
    expect(hash(helpCorpus())).toBe(hash(corpus));
  });

  it("carries every guide, answer, stage and page article, with their links", () => {
    for (const guide of GUIDES) {
      expect(corpus).toContain(`### ${guide.title}\nLink: /help#guide-${guide.slug}`);
    }
    for (const entry of FAQ) {
      expect(corpus).toContain(`### ${entry.question}\nLink: /help#faq-${entry.slug}`);
    }
    for (const stage of WORKFLOW) expect(corpus).toContain(`**${stage.title}**`);
    for (const entry of HELP_ENTRIES) {
      expect(corpus).toContain(`### ${entry.title}\nPage: ${entry.route}`);
    }
  });

  it("fits what the ai service holds", () => {
    // services/ai/app/help/corpus.py MAX_CHARS.
    expect(corpus.length).toBeLessThan(500_000);
  });
});

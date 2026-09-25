import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards for the unified theme (September 2026).
 *
 * The app was re-themed onto the home page's design: a light ground,
 * one accent (the tenant's brand), theme-aware status colours, and
 * surfaces that read from tokens rather than colour literals. Every rule
 * below is a way the old theme's habits — built for a dark navy ground —
 * silently broke on the new one, found by crawling all 160 pages. None
 * of them is a type error or a runtime error: a class that fails
 * contrast or computes to nearly-white just renders, and every other
 * test stays green. So they are scanned for here.
 *
 * Each rule names its allowlist, with the reason. Adding to one should
 * be as deliberate as the reason written next to it.
 */

const ROOTS = ["app", "components"];

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(entry.name) && !/\.(test|stories)\.tsx?$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

/** Source with comments blanked, so prose about a bad pattern — the
 *  kind of comment that explains why a rule exists — is not flagged. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/.*$/gm, (m, lead: string) => lead + " ".repeat(m.length - lead.length));
}

const FILES = ROOTS.flatMap(sourceFiles);

interface Hit {
  file: string;
  line: number;
  text: string;
}

function scan(pattern: RegExp, allow: Record<string, string> = {}): Hit[] {
  const hits: Hit[] = [];
  for (const file of FILES) {
    if (file in allow) continue;
    const src = code(file);
    for (const m of src.matchAll(pattern)) {
      const line = src.slice(0, m.index).split("\n").length;
      hits.push({ file, line, text: m[0].trim().slice(0, 100) });
    }
  }
  return hits;
}

const show = (hits: Hit[]) => hits.map((h) => `${h.file}:${h.line}  ${h.text}`);

/** Every quoted or template string, with where it starts. */
function classStrings(file: string): { text: string; index: number }[] {
  const src = code(file);
  return [...src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)].map((m) => ({
    text: m[1] ?? m[2],
    index: m.index ?? 0,
  }));
}

describe("theme guards", () => {
  it("scans the app", () => {
    // Guards the guard: an empty file list passes every rule below.
    expect(FILES.length).toBeGreaterThan(400);
  });

  it("uses theme tokens, not Tailwind's raw palette", () => {
    // bg-blue-500, text-purple-300 and friends bypass the theme: they do
    // not follow the tenant brand or the light/ink islands. Raw purple
    // and green classes were the last colours the re-theme had to chase.
    const hits = scan(
      /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|divide|placeholder|accent|shadow|decoration)-(?:red|blue|green|yellow|purple|orange|amber|emerald|sky|indigo|pink|rose|teal|cyan|lime|violet|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b/g,
    );
    expect(show(hits)).toEqual([]);
  });

  it("keeps colour literals to the few surfaces that need them", () => {
    const allow: Record<string, string> = {
      "app/(auth)/login/login-form.tsx":
        "SSO buttons carry the providers' mandated brand colours; the photo panel's gradient fallback.",
      "app/global-error.tsx":
        "Renders when the root layout failed, without the app stylesheet — inline light-theme values.",
      "components/home/home-hero.tsx":
        "The hero photo's overlay gradient and its missing-photo fallback.",
      "components/home/module-catalog.ts":
        "Module tile icon colours, solved for 3:1 on their tiles.",
      "app/(app)/schedule/[flightId]/manifest/page.tsx":
        "Print stylesheet: black on white regardless of theme.",
      "app/(app)/settings/branding/branding-form.tsx":
        "Placeholder text showing the hex format.",
      "app/(app)/settings/branding/actions.ts":
        "Validation message showing the hex format.",
      "components/flight-following/fleet-map.tsx":
        "Leaflet paints with colour strings; the start marker's white fill.",
    };
    const hits = scan(/["'`(:\s]#[0-9a-fA-F]{6}\b|["'`]#[0-9a-fA-F]{3}["'`]/g, allow).filter(
      // The theme's own colour helpers define colours on purpose.
      (h) => !h.file.startsWith("lib/"),
    );
    expect(show(hits)).toEqual([]);
  });

  it("does not fade text below AA with opacity", () => {
    // text-muted-foreground/70 was the navy theme's third text tier. On
    // white it lands at 2.5–3.8:1 — it failed on ~380 elements. Disabled
    // controls (cursor-not-allowed) may fade: inactive controls are
    // exempt, and the fade is what says "inactive". Icons sized with
    // h-*/w-* are decoration, not text.
    const faded = /(?<![\w:/-])text-(?:muted-foreground|status-[a-z]+|primary)\/(?:[1-8]\d|9\d?|[1-9])\b/;
    const hits: string[] = [];
    for (const file of FILES) {
      for (const s of classStrings(file)) {
        if (!faded.test(s.text)) continue;
        if (s.text.includes("cursor-not-allowed")) continue;
        if (/\bh-\d+(\.\d+)?\b/.test(s.text) && /\bw-\d+(\.\d+)?\b/.test(s.text)) continue;
        hits.push(`${file}: ${s.text.trim().slice(0, 90)}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("does not use muted grounds or hovers that vanish on white", () => {
    // The muted band (#f4f4f5) at /5–/50 computes to #fafafa–#fefefe:
    // table headers lost their band and ~200 hovers stopped showing.
    // The scale is bg-muted (pills), bg-muted/60 (bands), hover:bg-accent.
    const hits = scan(/(?<![\w/-])(?:(?:group-)?hover:|focus:)?bg-muted\/(?:5|10|20|25|30|40|50)\b/g);
    expect(show(hits)).toEqual([]);
  });

  it("keeps status and brand text on a tint it was solved for", () => {
    // The status tones clear AA on their own /10 and /15 tint; at /20+
    // the same text drops to ~4.2:1. Brand text is held to /10, the
    // "selected" tint: the tenant brand's contrast floor (brandTones) is
    // sized for /10, and a brand at that floor fails on /15 (4.35:1).
    const hits: string[] = [];
    for (const file of FILES) {
      for (const s of classStrings(file)) {
        for (const m of s.text.matchAll(/(?<![\w:/-])bg-(?:(status-[a-z]+)\/(?:20|25|30|35|40)|(primary)\/(?:15|20|25|30|35|40))\b/g)) {
          const hue = m[1] ?? m[2];
          if (new RegExp(`(?<![\\w:/-])text-${hue}(?![\\w/-])`).test(s.text) && !s.text.includes("cursor-not-allowed")) {
            hits.push(`${file}: ${s.text.trim().slice(0, 90)}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("only uses opacity steps Tailwind generates", () => {
    // Tailwind 3 builds opacity modifiers from its scale (fives, plus 8
    // and 12 added in tailwind.config.ts). An off-scale step like /7
    // generates no CSS at all — the active nav chip had no highlight
    // because of a /12 before the scale was extended.
    const scale = new Set([0, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
    const hits = scan(
      /\b(?:text|bg|border|ring|outline|fill|stroke|divide|from|via|to|shadow|placeholder|decoration)-(?:primary|brand(?:-[a-z]+)?|status-[a-z]+|muted(?:-foreground)?|foreground|background|card|border|input|accent|secondary|destructive|ink|white|black)\/(\d+)\b/g,
    ).filter((h) => !scale.has(Number(/\/(\d+)$/.exec(h.text)?.[1])));
    expect(show(hits)).toEqual([]);
  });

  it("keeps theme styling out of scoped <style> blocks", () => {
    // Seventeen forms each carried a <style> block redefining the same
    // input — eleven drifted variants. The field is .ff-input now.
    const allow: Record<string, string> = {
      "components/app-shell/brand-theme-style.tsx": "Emits the tenant's brand variables.",
      "app/(app)/schedule/[flightId]/manifest/page.tsx": "Print stylesheet for the release sheet.",
    };
    const hits = scan(/<style[\s>]/g, allow);
    expect(show(hits)).toEqual([]);
  });

  it("gives every page title the one title style", () => {
    // Titles came in 25 variants (xl to 3xl, bold to extrabold); a title
    // changed size as you moved between pages. Exceptions are not page
    // titles: the 404 numeral, the home hero, the release sheet's
    // letterhead, the error screen, and headings inside "not
    // authorised" notice cards (text-status-*).
    const allow = new Set([
      "app/not-found.tsx",
      "components/home/home-hero.tsx",
      "components/error-screen.tsx",
      "app/(app)/schedule/[flightId]/manifest/page.tsx",
    ]);
    const hits: string[] = [];
    for (const file of FILES) {
      if (allow.has(file)) continue;
      for (const m of code(file).matchAll(/<h1\b[^>]*?className="([^"]*)"/g)) {
        const cls = m[1].split(/\s+/);
        if (cls.some((c) => c.startsWith("text-status-"))) continue;
        const ok = ["text-2xl", "font-bold", "tracking-tight"].every((c) => cls.includes(c));
        const extra = cls.filter((c) => /^(?:(?:sm|md|lg):)?(?:text-(?:xs|sm|base|lg|xl|[3-9]xl)|font-(?:semibold|extrabold|black|medium))$/.test(c));
        if (!ok || extra.length) hits.push(`${file}: ${m[1]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("starts every page at the same height", () => {
    // Page containers used py-6, py-8, py-10 or py-12, so the title
    // jumped as you moved between pages.
    const hits: string[] = [];
    for (const file of FILES.filter((f) => f.endsWith("page.tsx"))) {
      for (const m of code(file).matchAll(/className="([^"]*)"/g)) {
        const cls = m[1].split(/\s+/);
        if (!cls.includes("mx-auto") || !cls.some((c) => c.startsWith("max-w-"))) continue;
        if (cls.some((c) => /^py-(?:6|10|12)$/.test(c))) hits.push(`${file}: ${m[1]}`);
      }
    }
    expect(hits).toEqual([]);
  });
});

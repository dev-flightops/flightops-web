import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * JSX text that follows a {value} keeps its leading space only when the
 * text holds no HTML entity.
 *
 * The fuel order list flagged an order below its flight's plan with
 * `Plan {planned.toLocaleString()} gal: check what&apos;s aboard`, and www
 * showed "Plan 60gal: check what's aboard". The page's server payload
 * already read `["Plan ", "60", "gal: check what's aboard"]`: Next's build
 * drops the space at the start of a text node when that node holds an
 * entity, and keeps it when it doesn't ("30 gal" beside it was fine). On
 * 6 Oct the same shape gave "Version 2of the document". Vitest compiles JSX
 * its own way and keeps the space, so no rendering test sees it.
 *
 * Write such a sentence as one template literal, or put `{" "}` after the
 * value. This refuses `}` then a space then text holding `&name;` before
 * the next `{` or `<`.
 */

const ROOTS = ["app", "components"];
const AFTER_VALUE = /\}([ \t]+[^{}<>]*?&(?:[a-zA-Z]+|#\d+);[^{}<>]*?)(?=[{<])/g;

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry.endsWith(".tsx") && !entry.endsWith(".test.tsx")) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap((root) => walk(root));

function offenders(file: string, src: string): string[] {
  const found: string[] = [];
  for (const m of src.matchAll(AFTER_VALUE)) {
    // An attribute list after an attribute's {value}, not a text node.
    if (/^\s*[\w-]+=/.test(m[1])) continue;
    const line = src.slice(0, m.index).split("\n").length;
    found.push(`${file}:${line}: }${m[1].replace(/\s+/g, " ").slice(0, 60)}`);
  }
  return found;
}

describe("JSX text after a {value}", () => {
  it("finds the components", () => {
    expect(FILES.length).toBeGreaterThan(300);
  });

  it("catches the shape that lost its space", () => {
    expect(offenders("x.tsx", "<div>Plan {n} gal: check what&apos;s aboard</div>")).toHaveLength(1);
    expect(offenders("x.tsx", "<div>{`Plan ${n} gal: check what's aboard`}</div>")).toEqual([]);
    expect(offenders("x.tsx", '<div>Plan {n}{" "}gal: check what&apos;s aboard</div>')).toEqual([]);
    expect(offenders("x.tsx", "<div>Plan {n} gal aboard</div>")).toEqual([]);
    expect(offenders("x.tsx", '<a href={x} title="it&apos;s">y</a>')).toEqual([]);
  });

  it("never starts with a space when it holds an HTML entity", () => {
    const found = FILES.flatMap((file) => offenders(file, stripComments(readFileSync(file, "utf8"))));
    expect(found).toEqual([]);
  });
});

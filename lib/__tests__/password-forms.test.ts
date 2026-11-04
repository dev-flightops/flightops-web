import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A form with a password field in it is sent as a POST (#134).
 *
 * Pressed before the page's script has loaded, a form is sent by the
 * browser itself, and one with no method goes as a GET. The sign-in did
 * that on a slow connection: the email and password went into the URL, so
 * into the server's logs and the browser's history. A form holding a
 * password field says method="post", or hands itself to a server action
 * (action={...}), which React sends as a POST.
 */

const ROOTS = ["app", "components"];
const FORM = /<form[\s>]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(entry) && !/\.(test|stories)\.tsx$/.test(entry)) out.push(p);
  }
  return out;
}

/** Comments out, so an apostrophe in one doesn't open a string. Only
 *  whole-line `//` comments: a URL's `//` is not one. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/[^\n]*$/gm, "");
}

/** The opening tag from `start`, to the `>` outside any `{...}` or string. */
function openingTag(src: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0) return src.slice(start, i + 1);
  }
  return src.slice(start);
}

function formsWithoutPost(src: string): string[] {
  const code = stripComments(src);
  if (!/type="password"/.test(code)) return [];
  return [...code.matchAll(FORM)]
    .map((m) => openingTag(code, m.index ?? 0))
    .filter((tag) => !/\bmethod="post"/.test(tag) && !/\baction=\{/.test(tag));
}

/** Forms that say neither: pressed before the script loads, the browser sends
 *  each as a GET, with its fields in the URL. */
function formsWithNoMethod(src: string): string[] {
  const code = stripComments(src);
  return [...code.matchAll(FORM)]
    .map((m) => openingTag(code, m.index ?? 0))
    .filter((tag) => !/\bmethod=/.test(tag) && !/\baction=/.test(tag));
}

describe("every form says how it sends (#134)", () => {
  it("has a method or an action", () => {
    // A search form that wants its fields in the URL says method="get".
    const files = ROOTS.flatMap((root) => walk(root));
    const offenders = files.flatMap((f) =>
      formsWithNoMethod(readFileSync(f, "utf8")).map((tag) => `${f}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("reads the tag it is given", () => {
    expect(formsWithNoMethod("<form onSubmit={save}><input name='email' /></form>")).toHaveLength(1);
    expect(formsWithNoMethod('<form method="post" onSubmit={save}></form>')).toEqual([]);
    expect(formsWithNoMethod('<form method="get"></form>')).toEqual([]);
    expect(formsWithNoMethod("<form action={save}></form>")).toEqual([]);
  });
});

describe("a form with a password field posts (#134)", () => {
  const files = ROOTS.flatMap((root) => walk(root));

  it("finds the forms it guards", () => {
    // The sign-in, Text messages' auth token, ForeFlight's key, a fuel
    // supplier's logins, the platform's sign-in and password.
    const guarded = files.filter((f) => /type="password"/.test(readFileSync(f, "utf8")));
    expect(guarded.length).toBeGreaterThanOrEqual(8);
  });

  it("each one says method=\"post\" or sends itself to a server action", () => {
    const offenders = files.flatMap((f) =>
      formsWithoutPost(readFileSync(f, "utf8")).map((tag) => `${f}: ${tag.replace(/\s+/g, " ").slice(0, 80)}`),
    );
    expect(offenders).toEqual([]);
  });

  it("reads a tag to its end past braces, strings and comments", () => {
    const src = `
      <form
        // a typed token doesn't linger
        aria-label={\`Add a login for \${name}\`}
        onSubmit={(e) => { if (a > b) e.preventDefault(); }}
      >
        <input type="password" name="password" />
      </form>`;
    expect(formsWithoutPost(src)).toHaveLength(1);
    expect(formsWithoutPost(src.replace("<form", '<form method="post"'))).toEqual([]);
    expect(formsWithoutPost(src.replace("<form", "<form action={save}"))).toEqual([]);
  });
});

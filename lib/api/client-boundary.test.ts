import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * No client component may call an API function directly.
 *
 * Every exported async function in lib/api goes through `apiFetch`,
 * which begins with `await auth()` to read the session and attach its
 * bearer token. That only works on the server. Imported into a "use
 * client" component it throws on every call — and because the call is
 * usually wrapped in a try/catch that renders "couldn't load", the
 * failure looks like a flaky backend rather than a boundary mistake.
 *
 * This is not hypothetical. The New Booking search form imported
 * `searchFlights` this way, so every flight search a reservations agent
 * ever ran threw and rendered "Couldn't search flights just now". The
 * search had never once returned a result, and the unit tests all
 * passed because they mocked the module the form should not have been
 * importing. Server actions are the way across; the mock hid the fact
 * that nothing was.
 *
 * Constants are fine — label maps and status tuples carry no session.
 * Types are fine; they are erased.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

/** Names in lib/api that reach the network: exported async functions. */
function serverOnlyExports(): Map<string, Set<string>> {
  const byModule = new Map<string, Set<string>>();
  for (const file of readdirSync("lib/api")) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const src = readFileSync(join("lib/api", file), "utf8");
    if (!src.includes("apiFetch")) continue;
    const names = new Set<string>();
    for (const m of src.matchAll(/export\s+async\s+function\s+(\w+)/g)) {
      names.add(m[1]);
    }
    if (names.size > 0) byModule.set(`@/lib/api/${file.slice(0, -3)}`, names);
  }
  return byModule;
}

function offendingImports(src: string, serverOnly: Map<string, Set<string>>) {
  const found: string[] = [];
  const importRe = /import\s+(type\s+)?({[^}]*}|[\w*]+)\s+from\s+"([^"]+)"/g;
  for (const m of src.matchAll(importRe)) {
    const [, typeOnly, clause, mod] = m;
    if (typeOnly) continue;
    const names = serverOnly.get(mod);
    if (!names) continue;
    for (const raw of clause.replace(/[{}]/g, "").split(",")) {
      const spec = raw.trim();
      if (!spec || spec.startsWith("type ")) continue;
      const local = spec.split(/\s+as\s+/)[0].trim();
      if (names.has(local)) found.push(`${local} from ${mod}`);
    }
  }
  return found;
}

describe("the client/server boundary in lib/api", () => {
  const serverOnly = serverOnlyExports();

  it("knows which exports reach the network", () => {
    // Guards the guard: if this drops to nothing the check below passes
    // vacuously and stops protecting anything.
    expect(serverOnly.size).toBeGreaterThan(10);
    expect(serverOnly.get("@/lib/api/flight-search")).toContain(
      "searchFlights",
    );
  });

  it("is not crossed by any client component", () => {
    const offenders: Array<{ file: string; imports: string[] }> = [];
    for (const file of walk("app")) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(src)) continue;
      const imports = offendingImports(src, serverOnly);
      if (imports.length > 0) offenders.push({ file, imports });
    }
    expect(offenders).toEqual([]);
  });
});

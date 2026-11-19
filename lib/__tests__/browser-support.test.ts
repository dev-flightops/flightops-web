import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Older iPads (#202). Next 16 builds for Safari 16.4 and later unless the
 * project says otherwise, and its own client code then carries class static
 * blocks, which Safari parses only from 16.4. On an iPad on iPadOS 15 the
 * page's script never ran: Sign In just posted the form back to the sign-in
 * page (the client, 19 Nov: "credentials get put in but login doesn't go
 * through", in Safari and in Chrome, which uses the same engine on iPad).
 * iPads that stop at iPadOS 15 (Air 2, mini 4) still fly. The list below
 * makes the build lower that syntax for them; keep it.
 */
describe("the browsers the build supports", () => {
  const pkg = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
    browserslist?: string[];
  };

  it("includes Safari 15 on iPad and the Mac", () => {
    expect(pkg.browserslist).toEqual(expect.arrayContaining(["ios_saf >= 15", "safari >= 15"]));
  });
});

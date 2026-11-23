import { describe, expect, it } from "vitest";

import { loadSource } from "./typed-load";

describe("loadSource (1119-04)", () => {
  it("names the typed numbers without a manifest", () => {
    expect(loadSource("typed", [])).toBe(
      "the passengers and cargo typed on the flight (no manifest yet; passengers at 190 lb)",
    );
  });

  it("names the manifest alone once it carries everything", () => {
    expect(loadSource("manifest", [])).toBe("the manifest");
    expect(loadSource("manifest", undefined)).toBe("the manifest");
  });

  it("says which typed part a manifest still stands on", () => {
    expect(loadSource("manifest", ["passengers", "freight"])).toBe(
      "the manifest, with the passengers and cargo typed on the flight until it has its own (passengers at 190 lb)",
    );
    expect(loadSource("manifest", ["freight"])).toBe(
      "the manifest, with the cargo typed on the flight until it has its own",
    );
  });
});

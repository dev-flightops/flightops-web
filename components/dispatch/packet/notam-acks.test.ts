import { describe, expect, it } from "vitest";

import { parseAckedIcaos, unacknowledgedNotamIcaos } from "./notam-acks";

describe("parseAckedIcaos", () => {
  it("returns [] for empty/missing", () => {
    expect(parseAckedIcaos(null)).toEqual([]);
    expect(parseAckedIcaos(undefined)).toEqual([]);
    expect(parseAckedIcaos("")).toEqual([]);
  });

  it("uppercases, trims, and dedupes", () => {
    expect(parseAckedIcaos(" panc , pabe,PANC ")).toEqual(["PANC", "PABE"]);
  });
});

describe("unacknowledgedNotamIcaos (release gate)", () => {
  it("empty route → nothing to acknowledge, no block", () => {
    expect(unacknowledgedNotamIcaos([], [])).toEqual([]);
    expect(unacknowledgedNotamIcaos([], ["PANC"])).toEqual([]);
  });

  it("no acks → every stop is unacknowledged (blocks)", () => {
    expect(unacknowledgedNotamIcaos(["PANC", "PABE"], [])).toEqual([
      "PANC",
      "PABE",
    ]);
  });

  it("partial acks → only the unacked stops remain (still blocks)", () => {
    expect(unacknowledgedNotamIcaos(["PANC", "PABE"], ["PANC"])).toEqual([
      "PABE",
    ]);
  });

  it("all acked → [] (unblocks Generate PDF)", () => {
    expect(
      unacknowledgedNotamIcaos(["PANC", "PABE"], ["PABE", "PANC"]),
    ).toEqual([]);
  });

  it("matches case-insensitively", () => {
    expect(unacknowledgedNotamIcaos(["PANC"], ["panc"])).toEqual([]);
  });

  it("ignores acks for stops no longer in the route", () => {
    // Dispatcher removed PADU from the route but its stale ack lingers in
    // the URL — it must not count toward acknowledging PANC/PABE.
    expect(
      unacknowledgedNotamIcaos(["PANC", "PABE"], ["PADU", "PANC"]),
    ).toEqual(["PABE"]);
  });
});

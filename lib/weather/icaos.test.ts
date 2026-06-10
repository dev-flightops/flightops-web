import { describe, expect, it } from "vitest";

import { parseIcaos } from "./icaos";

describe("parseIcaos", () => {
  it("uppercases + accepts 3-4 letter codes", () => {
    expect(parseIcaos("panc paen padu")).toEqual(["PANC", "PAEN", "PADU"]);
  });

  it("accepts 3-letter codes (FAA identifiers)", () => {
    expect(parseIcaos("anc bet dlg")).toEqual(["ANC", "BET", "DLG"]);
  });

  it("splits on whitespace, commas, and semicolons", () => {
    expect(parseIcaos("PANC, PAEN; PADU PANI")).toEqual([
      "PANC",
      "PAEN",
      "PADU",
      "PANI",
    ]);
  });

  it("dedupes preserving first-seen order", () => {
    expect(parseIcaos("PANC PAEN panc")).toEqual(["PANC", "PAEN"]);
  });

  it("drops anything that isn't 3-4 letters", () => {
    expect(parseIcaos("PA P PANI 12 PA12 KLAX !!  PANC")).toEqual([
      "PANI",
      "KLAX",
      "PANC",
    ]);
  });

  it("returns an empty array for empty / whitespace-only input", () => {
    expect(parseIcaos("")).toEqual([]);
    expect(parseIcaos("   ")).toEqual([]);
    expect(parseIcaos(",,,;")).toEqual([]);
  });
});

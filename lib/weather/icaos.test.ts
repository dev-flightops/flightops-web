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

  it("drops anything that isn't 3-4 letters or digits", () => {
    expect(parseIcaos("PA P PANI 12 PA12 KLAX !!  PANC P-AB")).toEqual([
      "PANI",
      "PA12",
      "KLAX",
      "PANC",
    ]);
  });

  it("keeps FAA identifiers with digits, such as Levelock's 9Z8 (#105)", () => {
    expect(parseIcaos("pakn 9z8 z13")).toEqual(["PAKN", "9Z8", "Z13"]);
  });

  it("returns an empty array for empty / whitespace-only input", () => {
    expect(parseIcaos("")).toEqual([]);
    expect(parseIcaos("   ")).toEqual([]);
    expect(parseIcaos(",,,;")).toEqual([]);
  });
});

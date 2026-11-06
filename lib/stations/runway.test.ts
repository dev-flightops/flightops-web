import { describe, expect, it } from "vitest";

import { formatFaaDate, runwayFigures } from "./runway";

describe("a runway's figures", () => {
  it("name, size and heading", () => {
    expect(runwayFigures({ name: "01/19", length_ft: 3284, width_ft: 60, true_alignment_deg: 26 })).toBe(
      "01/19 · 3,284 × 60 ft · 26° true",
    );
  });

  it("a heading of zero is a heading", () => {
    expect(runwayFigures({ name: "18/36", length_ft: 900, width_ft: 40, true_alignment_deg: 0 })).toBe(
      "18/36 · 900 × 40 ft · 0° true",
    );
  });

  it("says when the file has none", () => {
    expect(runwayFigures({ name: "E/W", length_ft: 1200, width_ft: 40, true_alignment_deg: null })).toBe(
      "E/W · 1,200 × 40 ft · no heading on file",
    );
  });
});

describe("the file's date", () => {
  it("reads as a date", () => {
    expect(formatFaaDate("2026-10-29")).toBe("29 Oct 2026");
  });

  it("leaves anything else alone", () => {
    expect(formatFaaDate("soon")).toBe("soon");
  });
});

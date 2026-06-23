import { describe, expect, it } from "vitest";

import { defaultRange, isHistoryTab } from "./tabs";

describe("isHistoryTab", () => {
  it("accepts the two known tabs", () => {
    expect(isHistoryTab("flight")).toBe(true);
    expect(isHistoryTab("duty")).toBe(true);
  });

  it("rejects undefined and unknown values", () => {
    expect(isHistoryTab(undefined)).toBe(false);
    expect(isHistoryTab("trends")).toBe(false);
    expect(isHistoryTab("")).toBe(false);
  });
});

describe("defaultRange", () => {
  it("returns a 30-day window ending today (UTC)", () => {
    const { from, to } = defaultRange();
    const fromDate = new Date(from + "T00:00:00Z");
    const toDate = new Date(to + "T00:00:00Z");
    // Use millisecond arithmetic to avoid DST surprises.
    const delta = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(delta).toBe(30);
  });

  it("returns YYYY-MM-DD formatted strings", () => {
    const { from, to } = defaultRange();
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

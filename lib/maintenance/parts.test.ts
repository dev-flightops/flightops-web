import { describe, expect, it } from "vitest";

import { certLabel, dayLabel, formatCost, formatQty } from "./parts";

describe("how parts read (#172)", () => {
  it("drops the decimals on whole stock", () => {
    expect(formatQty(5)).toBe("5");
    expect(formatQty(2.5)).toBe("2.5");
    expect(formatQty(2.25)).toBe("2.25");
    expect(formatQty(-3)).toBe("-3");
  });

  it("gives a cost in dollars, or a dash", () => {
    expect(formatCost(12.5)).toBe("$12.50");
    expect(formatCost(null)).toBe("—");
  });

  it("reads a day as that day, whatever the zone", () => {
    expect(dayLabel("2026-11-05")).toBe("Nov 5, 2026");
    expect(dayLabel(null)).toBe("—");
    expect(dayLabel("not a day")).toBe("not a day");
  });

  it("names a certificate", () => {
    expect(certLabel("ap")).toBe("A&P");
    expect(certLabel("ia")).toBe("IA");
    expect(certLabel("repairman")).toBe("Repairman");
    expect(certLabel(null)).toBe("—");
    expect(certLabel("nonsense")).toBe("—");
  });
});

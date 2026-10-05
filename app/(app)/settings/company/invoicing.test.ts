import { describe, expect, it } from "vitest";

import {
  parseCargoRate,
  parseTaxPercent,
  parseTermsDays,
  taxPercentFromFraction,
} from "./invoicing";

/**
 * These values price every invoice the operator raises, so they are
 * converted on decimal strings and the edges are pinned: where a value
 * is refused, and that nothing is rounded on the way to the service.
 */

describe("parseCargoRate", () => {
  it("sends four decimals, as the column holds them", () => {
    expect(parseCargoRate("0.475")).toBe("0.4750");
    expect(parseCargoRate("0.4750")).toBe("0.4750");
    expect(parseCargoRate(" 1 ")).toBe("1.0000");
    expect(parseCargoRate("12.")).toBe("12.0000");
    expect(parseCargoRate("0")).toBe("0.0000");
  });

  it("clears on a blank field", () => {
    expect(parseCargoRate("")).toBeNull();
    expect(parseCargoRate("   ")).toBeNull();
  });

  it("refuses what the service would refuse", () => {
    expect(parseCargoRate("-0.5")).toBeUndefined();
    // A fifth decimal would be rounded away by Numeric(10, 4).
    expect(parseCargoRate("0.47505")).toBeUndefined();
    // Seven whole digits do not fit.
    expect(parseCargoRate("1000000")).toBeUndefined();
    expect(parseCargoRate("$0.50")).toBeUndefined();
    expect(parseCargoRate("0,50")).toBeUndefined();
  });
});

describe("parseTaxPercent", () => {
  it("turns a percentage into the stored fraction without rounding", () => {
    // 7.5 / 100 in floating point is 0.07500000000000001.
    expect(parseTaxPercent("7.5")).toBe("0.07500");
    expect(parseTaxPercent("6.25")).toBe("0.06250");
    expect(parseTaxPercent("7.125")).toBe("0.07125");
    expect(parseTaxPercent("0")).toBe("0.00000");
    expect(parseTaxPercent("100")).toBe("1.00000");
  });

  it("clears on a blank field", () => {
    expect(parseTaxPercent("")).toBeNull();
  });

  it("refuses more than 100 %, a sign, or a fourth decimal", () => {
    expect(parseTaxPercent("101")).toBeUndefined();
    expect(parseTaxPercent("100.001")).toBeUndefined();
    expect(parseTaxPercent("-1")).toBeUndefined();
    expect(parseTaxPercent("7.1255")).toBeUndefined();
    expect(parseTaxPercent("7.5%")).toBeUndefined();
  });
});

describe("taxPercentFromFraction", () => {
  it("shows the stored fraction as the percentage that was typed", () => {
    expect(taxPercentFromFraction("0.07500")).toBe("7.5");
    expect(taxPercentFromFraction("0.07125")).toBe("7.125");
    expect(taxPercentFromFraction("1.00000")).toBe("100");
    expect(taxPercentFromFraction("0.00000")).toBe("0");
  });

  it("round-trips with parseTaxPercent", () => {
    for (const typed of ["7.5", "6.25", "0.125", "100", "0"]) {
      expect(taxPercentFromFraction(parseTaxPercent(typed) as string)).toBe(typed);
    }
  });

  it("is blank when unset", () => {
    expect(taxPercentFromFraction(null)).toBe("");
  });
});

describe("parseTermsDays", () => {
  it("takes whole days from 0 to 365", () => {
    expect(parseTermsDays("14")).toBe(14);
    expect(parseTermsDays("0")).toBe(0);
    expect(parseTermsDays("365")).toBe(365);
  });

  it("clears on a blank field", () => {
    expect(parseTermsDays("")).toBeNull();
  });

  it("refuses a year and a day, a fraction or a sign", () => {
    expect(parseTermsDays("366")).toBeUndefined();
    expect(parseTermsDays("400")).toBeUndefined();
    expect(parseTermsDays("14.5")).toBeUndefined();
    expect(parseTermsDays("-1")).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";

import {
  isOverdue,
  money,
  quantity,
  statusClasses,
  unitPrice,
} from "./money";

/**
 * These strings go on a document somebody pays against, and the same
 * invoice is read on screen and as a PDF. The formatting is asserted
 * here against the same cases the Python side asserts.
 */

describe("money", () => {
  it("renders cents as an amount", () => {
    expect(money(0)).toBe("0.00");
    expect(money(6875)).toBe("68.75");
    expect(money(900)).toBe("9.00");
  });

  it("groups thousands", () => {
    expect(money(123_456_789)).toBe("1,234,567.89");
  });

  it("parenthesises negatives rather than signing them", () => {
    // A leading minus in a right-aligned column is easy to miss;
    // (12.50) is not.
    expect(money(-1250)).toBe("(12.50)");
  });

  it("keeps the cents on a round amount", () => {
    // "485" instead of "485.00" on an invoice reads as an estimate.
    expect(money(48_500)).toBe("485.00");
  });
});

describe("quantity", () => {
  it("trims trailing zeros", () => {
    expect(quantity(1000)).toBe("1");
  });

  it("keeps a half pound", () => {
    expect(quantity(137_500)).toBe("137.5");
  });

  it("handles zero", () => {
    expect(quantity(0)).toBe("0");
  });
});

describe("unitPrice", () => {
  it("shows a cargo rate to four decimals, so the line multiplies out", () => {
    // 100 lb x 0.4750 = 47.50. Rounded to 0.48 it would read 48.00.
    expect(unitPrice({ unit_price: "0.4750", unit_price_cents: 48 })).toBe("0.4750");
  });

  it("shows a price in whole cents to the cent, as the PDF does", () => {
    expect(unitPrice({ unit_price: "1200.3000", unit_price_cents: 120_030 })).toBe(
      "1,200.30",
    );
    expect(unitPrice({ unit_price: "0.5000", unit_price_cents: 50 })).toBe("0.50");
    expect(unitPrice({ unit_price: "0.0000", unit_price_cents: 0 })).toBe("0.00");
  });

  it("groups thousands and parenthesises negatives like money()", () => {
    expect(unitPrice({ unit_price: "1234.5678", unit_price_cents: 123_457 })).toBe(
      "1,234.5678",
    );
    expect(unitPrice({ unit_price: "-0.1250", unit_price_cents: -13 })).toBe("(0.1250)");
  });

  it("falls back to the cents on a line from before four decimals were kept", () => {
    expect(unitPrice({ unit_price: null, unit_price_cents: 48 })).toBe("0.48");
    expect(unitPrice({ unit_price_cents: 45_000 })).toBe("450.00");
  });
});

describe("status colours", () => {
  it("does not paint a void invoice red", () => {
    // A voided invoice is a closed matter, not something to act on.
    // Red would put it in the same visual class as an overdue one.
    expect(statusClasses("void")).not.toMatch(/status-red/);
    expect(statusClasses("void")).toMatch(/muted/);
  });

  it("distinguishes every status", () => {
    const seen = new Set(
      ["draft", "sent", "paid", "void"].map((s) => statusClasses(s)),
    );
    expect(seen.size).toBe(4);
  });
});

describe("overdue", () => {
  it("is only about sent invoices", () => {
    // A draft has not been asked for yet, and a paid or void one is
    // finished. Only a sent invoice can be late.
    expect(isOverdue("draft", "2026-01-01", "2026-09-10")).toBe(false);
    expect(isOverdue("paid", "2026-01-01", "2026-09-10")).toBe(false);
    expect(isOverdue("void", "2026-01-01", "2026-09-10")).toBe(false);
    expect(isOverdue("sent", "2026-01-01", "2026-09-10")).toBe(true);
  });

  it("is not overdue on the due date itself", () => {
    // Compared as calendar dates rather than instants: an invoice due
    // today is not late at 00:01 in a zone ahead of the operator.
    expect(isOverdue("sent", "2026-09-10", "2026-09-10")).toBe(false);
  });

  it("is not overdue without a due date", () => {
    expect(isOverdue("sent", null, "2026-09-10")).toBe(false);
  });
});

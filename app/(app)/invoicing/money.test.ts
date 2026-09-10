import { describe, expect, it } from "vitest";

import { isOverdue, money, quantity, statusClasses } from "./money";

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

import { describe, expect, it } from "vitest";

import {
  centsToInput,
  FORM_METHODS,
  isFormMethod,
  METHOD_LABELS,
  parseAmount,
  todayLocalIsoDate,
} from "./payments";

describe("the methods the form offers", () => {
  it("are cash, check, card, ACH or wire, and other, in that order", () => {
    expect(FORM_METHODS.map((m) => [m.value, m.label])).toEqual([
      ["cash", "Cash"],
      ["check", "Check"],
      ["card", "Card"],
      ["transfer", "ACH or wire"],
      ["other", "Other"],
    ]);
  });

  it("leave out on-account and comp until the client decides how they count", () => {
    expect(isFormMethod("account")).toBe(false);
    expect(isFormMethod("comp")).toBe(false);
    expect(isFormMethod("crypto")).toBe(false);
    expect(isFormMethod("transfer")).toBe(true);
  });

  it("still name on-account and comp in the history, which can hold them", () => {
    expect(METHOD_LABELS.account).toBe("On account");
    expect(METHOD_LABELS.comp).toBe("Comp");
  });
});

describe("parseAmount", () => {
  it("reads whole and decimal amounts as cents", () => {
    expect(parseAmount("250")).toBe(25_000);
    expect(parseAmount("250.5")).toBe(25_050);
    expect(parseAmount("250.50")).toBe(25_050);
    expect(parseAmount(" 0.07 ")).toBe(7);
  });

  it("accepts a dollar sign and thousands commas", () => {
    expect(parseAmount("$1,250.00")).toBe(125_000);
    expect(parseAmount("1,000,000")).toBe(100_000_000);
  });

  it("does not read a comma as a decimal point", () => {
    // "1,00" typed by habit from a decimal-comma locale is not a dollar.
    expect(parseAmount("1,00")).toBeNull();
    expect(parseAmount("12,5")).toBeNull();
  });

  it("refuses what is not an amount", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("2.505")).toBeNull();
    expect(parseAmount("1e3")).toBeNull();
  });

  it("round-trips the form's own default", () => {
    expect(parseAmount(centsToInput(60_000))).toBe(60_000);
    expect(parseAmount(centsToInput(123_456_789))).toBe(123_456_789);
  });
});

describe("centsToInput", () => {
  it("keeps the cents and leaves out grouping", () => {
    expect(centsToInput(60_000)).toBe("600.00");
    expect(centsToInput(7)).toBe("0.07");
    expect(centsToInput(123_456_789)).toBe("1234567.89");
  });
});

describe("todayLocalIsoDate", () => {
  it("is the local calendar date, not the UTC one", () => {
    // 23:30 local on 31 Oct is 1 Nov in UTC anywhere west of Greenwich;
    // a cheque received that evening was received in October.
    const evening = new Date(2026, 9, 31, 23, 30);
    expect(todayLocalIsoDate(evening)).toBe("2026-10-31");
  });
});

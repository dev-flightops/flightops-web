import { describe, expect, it } from "vitest";

import type { AccountingExportRow } from "@/lib/api/types";

import { csvCell, rowsToCsv } from "./csv";

function row(overrides: Partial<AccountingExportRow> = {}): AccountingExportRow {
  return {
    id: "f-1",
    date: "2026-09-15",
    flight_number: "EX902",
    flight_type: "scheduled",
    origin: "PANC",
    destination: "PABE",
    aircraft_tail: "N208EX",
    pic_name: "Pat Pilot",
    customer: null,
    revenue_pax: 5,
    cargo_lbs: 250,
    mail_lbs: null,
    notes: null,
    ...overrides,
  };
}

describe("csvCell: formula-safe", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
    ["\tcmd", "'\tcmd"],
  ])("guards %j as %j", (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it("guards a leading carriage return, then quotes the cell for it", () => {
    expect(csvCell("\r=1+1")).toBe("\"'\r=1+1\"");
  });

  it("guards first and quotes second, so the apostrophe is inside the quotes", () => {
    expect(csvCell('=HYPERLINK("https://x.example","Pay")')).toBe(
      '"\'=HYPERLINK(""https://x.example"",""Pay"")"',
    );
  });

  it("leaves cells alone that only contain those characters later on", () => {
    for (const v of ["PANC", "2026-09-01", "N208EX", "a=b", "1-2", "x@y.example"]) {
      expect(csvCell(v)).toBe(v);
    }
  });

  it("writes numbers as numbers, a negative one included", () => {
    expect(csvCell(250)).toBe("250");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(-5)).toBe("-5");
  });

  it("writes null and undefined as empty cells", () => {
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("still quotes commas, quotes and line breaks", () => {
    expect(csvCell("smooth, on time")).toBe('"smooth, on time"');
    expect(csvCell('said "ok"')).toBe('"said ""ok"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });
});

describe("rowsToCsv", () => {
  it("R6: starts with the header row, column by column", () => {
    expect(rowsToCsv([])).toBe(
      "Date,Flight #,Type,Origin,Destination,Aircraft,PIC,Customer,Rev Pax,Cargo lbs,Mail lbs,Notes",
    );
  });

  it("T7: a note that begins =HYPERLINK( comes out as a cell that begins '=HYPERLINK(", () => {
    const csv = rowsToCsv([
      row({ notes: '=HYPERLINK("https://x.example","Pay")' }),
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(
      "2026-09-15,EX902,scheduled,PANC,PABE,N208EX,Pat Pilot,,5,250,," +
        '"\'=HYPERLINK(""https://x.example"",""Pay"")"',
    );
  });

  it("guards every text column, not just notes", () => {
    const csv = rowsToCsv([
      row({ pic_name: "@admin", flight_number: "+EX1", aircraft_tail: "-N1" }),
    ]);
    expect(csv.split("\n")[1]).toBe(
      "2026-09-15,'+EX1,scheduled,PANC,PABE,'-N1,'@admin,,5,250,,",
    );
  });
});

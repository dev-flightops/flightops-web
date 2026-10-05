import { describe, expect, it } from "vitest";

import type { AccountingExportRow } from "@/lib/api/types";

import { csvCell, csvFilename, rowsToCsv } from "./csv";

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
    customer_type: null,
    revenue_pax: 5,
    total_pax: 6,
    cargo_lbs: 250,
    mail_lbs: 0,
    cargo_description: null,
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
  it("#27: legacy's 15 headers, in legacy's order, and a CRLF after every line", () => {
    expect(rowsToCsv([])).toBe(
      "Date,Flight #,Type,Origin,Destination,Aircraft,PIC,Customer,Customer Type," +
        "Revenue Pax,Total Pax,Cargo (lbs),Mail (lbs),Cargo Description,Notes\r\n",
    );
  });

  it("#27: one row carries every column, legacy's way", () => {
    const csv = rowsToCsv([
      row({
        customer: "Acme Mining",
        customer_type: "corporate",
        cargo_lbs: 150.5,
        mail_lbs: 55,
        cargo_description: "Drill bits; Groceries",
        notes: "smooth",
      }),
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      "2026-09-15,EX902,scheduled,PANC,PABE,N208EX,Pat Pilot,Acme Mining,corporate," +
        "5,6,150.5,55,Drill bits; Groceries,smooth",
    );
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("#27: the file is named as legacy names it", () => {
    expect(csvFilename("2026-09-01", "2026-09-30")).toBe(
      "peregrine_activity_2026-09-01_2026-09-30.csv",
    );
  });

  it("T7: a note that begins =HYPERLINK( comes out as a cell that begins '=HYPERLINK(", () => {
    const csv = rowsToCsv([
      row({ notes: '=HYPERLINK("https://x.example","Pay")' }),
    ]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // header, the row, and the empty string after the last CRLF
    expect(lines[1]).toBe(
      "2026-09-15,EX902,scheduled,PANC,PABE,N208EX,Pat Pilot,,,5,6,250,0,," +
        '"\'=HYPERLINK(""https://x.example"",""Pay"")"',
    );
  });

  it("guards every text column, not just notes", () => {
    const csv = rowsToCsv([
      row({
        pic_name: "@admin",
        flight_number: "+EX1",
        aircraft_tail: "-N1",
        customer: "=Evil Co",
        cargo_description: "+bits",
      }),
    ]);
    expect(csv.split("\r\n")[1]).toBe(
      "2026-09-15,'+EX1,scheduled,PANC,PABE,'-N1,'@admin,'=Evil Co,,5,6,250,0,'+bits,",
    );
  });
});

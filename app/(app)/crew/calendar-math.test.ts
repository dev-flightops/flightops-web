import { describe, expect, it } from "vitest";

import type { DutyType, RosterEntry } from "@/lib/api/crew-calendar";

import {
  isValidMonth,
  monthDays,
  monthLabel,
  monthOf,
  rowSegments,
  shiftMonth,
} from "./calendar-math";

function entry(
  id: string,
  start: string,
  end: string,
  duty: DutyType = "flying",
): RosterEntry {
  return {
    id,
    user_id: "u1",
    station: "PABE",
    airframe_type: "caravan",
    aircraft_id: null,
    tail_number: null,
    start_date: start,
    end_date: end,
    duty_type: duty,
    notes: null,
  };
}

describe("months", () => {
  it("shifts across year ends both ways", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-10", 14)).toBe("2027-12");
  });

  it("accepts only YYYY-MM", () => {
    expect(isValidMonth("2026-10")).toBe(true);
    for (const bad of ["2026-13", "2026-1", "26-10", "", undefined, null]) {
      expect(isValidMonth(bad)).toBe(false);
    }
  });

  it("labels and derives months", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthOf("2026-10-05")).toBe("2026-10");
  });
});

describe("monthDays", () => {
  it("lists every day with its weekday and whether it is a weekend", () => {
    const days = monthDays("2026-10-01", "2026-10-31");
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({
      iso: "2026-10-01",
      day: 1,
      weekday: "Th",
      weekend: false,
    });
    expect(days[2]).toMatchObject({ iso: "2026-10-03", weekday: "Sa", weekend: true });
    expect(days[3]).toMatchObject({ iso: "2026-10-04", weekday: "Su", weekend: true });
  });

  it("knows a leap February", () => {
    expect(monthDays("2028-02-01", "2028-02-29")).toHaveLength(29);
  });
});

describe("rowSegments", () => {
  const span = (segs: ReturnType<typeof rowSegments>) =>
    segs.reduce((n, s) => n + (s.kind === "entry" ? s.span : 1), 0);

  it("fills a month with no assignments with empty days", () => {
    const segs = rowSegments([], "2026-10-01", "2026-10-31");
    expect(segs).toHaveLength(31);
    expect(segs.every((s) => s.kind === "empty")).toBe(true);
  });

  it("draws each assignment as one block, clipped to the month", () => {
    const segs = rowSegments(
      [
        entry("late", "2026-10-30", "2026-11-04"),
        entry("early", "2026-09-28", "2026-10-02"),
      ],
      "2026-10-01",
      "2026-10-31",
    );
    expect(segs[0]).toMatchObject({
      kind: "entry",
      start: "2026-10-01",
      span: 2,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(segs[segs.length - 1]).toMatchObject({
      kind: "entry",
      start: "2026-10-30",
      span: 2,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(segs.filter((s) => s.kind === "empty")).toHaveLength(27);
    expect(span(segs)).toBe(31);
  });

  it("never draws an overlapping assignment on top of the one before it", () => {
    const segs = rowSegments(
      [entry("a", "2026-10-05", "2026-10-10"), entry("b", "2026-10-08", "2026-10-12")],
      "2026-10-01",
      "2026-10-31",
    );
    const blocks = segs.filter((s) => s.kind === "entry");
    expect(blocks).toMatchObject([
      { start: "2026-10-05", span: 6 },
      { start: "2026-10-11", span: 2 },
    ]);
    expect(span(segs)).toBe(31);
  });

  it("ignores assignments outside the month", () => {
    const segs = rowSegments(
      [entry("sept", "2026-09-01", "2026-09-30"), entry("nov", "2026-11-01", "2026-11-02")],
      "2026-10-01",
      "2026-10-31",
    );
    expect(segs.every((s) => s.kind === "empty")).toBe(true);
  });
});

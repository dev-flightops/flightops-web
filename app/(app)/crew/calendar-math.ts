/**
 * Pure date arithmetic for the crew calendar's month grid. Every value is
 * a calendar day ("YYYY-MM-DD") or month ("YYYY-MM"), never a moment, so
 * nothing here depends on the time zone it runs in.
 */

import type { RosterEntry } from "@/lib/api/crew-calendar";
import { isoDayDiff, shiftIsoDay } from "@/lib/iso-day";

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidMonth(raw: string | undefined | null): raw is string {
  return typeof raw === "string" && MONTH.test(raw);
}

/** The month a calendar day falls in. */
export function monthOf(isoDay: string): string {
  return isoDay.slice(0, 7);
}

/** Move a month by whole months: shiftMonth("2026-12", 1) is "2027-01". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mon = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(mon).padStart(2, "0")}`;
}

/** "October 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export interface GridDay {
  iso: string;
  day: number;
  /** Two-letter weekday, as legacy labels its columns: "Mo" … "Su". */
  weekday: string;
  weekend: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function monthDays(firstDay: string, lastDay: string): GridDay[] {
  const days: GridDay[] = [];
  for (let iso = firstDay; iso <= lastDay; iso = shiftIsoDay(iso, 1)) {
    const [y, m, d] = iso.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    days.push({ iso, day: d, weekday: WEEKDAYS[dow], weekend: dow === 0 || dow === 6 });
  }
  return days;
}

/** One stretch of a pilot's row: an assignment, or a single empty day. */
export type RowSegment =
  | { kind: "entry"; entry: RosterEntry; start: string; span: number; continuesBefore: boolean; continuesAfter: boolean }
  | { kind: "empty"; iso: string };

/**
 * Lay one pilot's assignments across the month: each assignment becomes
 * one block clipped to the month, and every other day an empty cell.
 * The API keeps a pilot to one assignment per day; if two ever did
 * overlap, the later one is drawn from the day after the earlier one
 * ends, never on top of it.
 */
export function rowSegments(
  entries: readonly RosterEntry[],
  firstDay: string,
  lastDay: string,
): RowSegment[] {
  const sorted = [...entries].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const segments: RowSegment[] = [];
  let cursor = firstDay;
  for (const entry of sorted) {
    if (entry.end_date < cursor || entry.start_date > lastDay) continue;
    const start = entry.start_date > cursor ? entry.start_date : cursor;
    const end = entry.end_date < lastDay ? entry.end_date : lastDay;
    for (let iso = cursor; iso < start; iso = shiftIsoDay(iso, 1)) {
      segments.push({ kind: "empty", iso });
    }
    segments.push({
      kind: "entry",
      entry,
      start,
      span: isoDayDiff(start, end) + 1,
      continuesBefore: entry.start_date < firstDay,
      continuesAfter: entry.end_date > lastDay,
    });
    cursor = shiftIsoDay(end, 1);
  }
  for (let iso = cursor; iso <= lastDay; iso = shiftIsoDay(iso, 1)) {
    segments.push({ kind: "empty", iso });
  }
  return segments;
}

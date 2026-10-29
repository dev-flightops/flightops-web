/**
 * Local time at the departure base (#68).
 *
 * Dispatchers book and create flights in their own local time. The
 * forms used to read what was typed as UTC, so the client's "11:30am"
 * flight was stored as 11:30Z, 03:30 in Alaska, and the risk matrix
 * scored it as a night departure. Times are typed and shown in the
 * departure base's zone and stored in UTC, as before.
 *
 * "Local" means what it means on the dispatch packet (services
 * ops/app/dispatch_packet.py `_timezone`): the departure base's zone,
 * else any zone the company set on a base, else Alaska's.
 *
 * Client-safe: no API calls. `loadZoneTable` in lib/api/auth.ts builds
 * the table on the server.
 */

export const DEFAULT_TIME_ZONE = "America/Anchorage";

/** Zones by base ICAO, and the one to use for any other airport. */
export interface ZoneTable {
  byIcao: Record<string, string>;
  fallback: string;
}

export const DEFAULT_ZONE_TABLE: ZoneTable = { byIcao: {}, fallback: DEFAULT_TIME_ZONE };

function isZone(name: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** The table for a company's bases. A zone Intl does not know is
 *  ignored rather than trusted. */
export function zoneTable(
  bases: readonly { icao: string; timezone: string | null }[],
): ZoneTable {
  const byIcao: Record<string, string> = {};
  for (const base of bases) {
    const zone = base.timezone?.trim();
    if (zone && isZone(zone)) byIcao[base.icao.trim().toUpperCase()] = zone;
  }
  return { byIcao, fallback: Object.values(byIcao)[0] ?? DEFAULT_TIME_ZONE };
}

/** The zone a flight departing `origin` is booked in. */
export function zoneFor(table: ZoneTable, origin: string | null | undefined): string {
  return table.byIcao[(origin ?? "").trim().toUpperCase()] ?? table.fallback;
}

/** The zone's offset from UTC at `instant`, in minutes (AKDT: -480). */
function offsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour"),
    part("minute"),
    part("second"),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/**
 * "2026-10-11T11:30" typed in `timeZone` → "2026-10-11T19:30:00Z".
 * Null when the value is not a datetime-local value. A wall-clock time
 * that does not exist (the spring-forward hour, early on a Sunday in
 * March) comes out an hour off.
 */
export function localToUtcIso(local: string, timeZone: string): string | null {
  const m = LOCAL_INPUT.exec(local.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  // The offset at the wall-clock instant read as UTC is right except
  // within hours of a change; one correction settles it.
  let utc = wall - offsetMinutes(timeZone, new Date(wall)) * 60_000;
  const settled = offsetMinutes(timeZone, new Date(utc));
  utc = wall - settled * 60_000;
  return new Date(utc).toISOString().replace(".000Z", "Z");
}

/** "2026-10-11T19:30:00Z" → "2026-10-11T11:30" in `timeZone`, for a
 *  datetime-local input. */
export function utcToLocalInput(iso: string, timeZone: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return "";
  const shifted = new Date(instant.getTime() + offsetMinutes(timeZone, instant) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** The calendar day `at` falls on in `timeZone`, "2026-10-28": at 8 pm
 *  in Alaska, UTC is already on the 29th. The schedule (#137) and the
 *  dispatch packet (#101) list flights by the company's day. */
export function localDay(timeZone: string, at: Date = new Date()): string {
  return utcToLocalInput(at.toISOString(), timeZone).slice(0, 10);
}

/** "AKDT" for Alaska in summer, "AKST" in winter. */
export function zoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return name ?? timeZone;
}

/** "Alaska Time": a zone's name without daylight or standard, for saying
 *  where a day or a month ends (#128). UTC stays "UTC". */
export function zoneName(timeZone: string, at: Date = new Date()): string {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return "UTC";
  const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return name ?? timeZone;
}

/** The calendar year and month (1-12) an instant falls in, in `timeZone`:
 *  on the evening of the 31st in Alaska, UTC is already in the next month. */
export function localYearMonth(
  timeZone: string,
  at: Date = new Date(),
): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month") };
}

/** "11:30 AKDT" for an instant, in `timeZone`. */
export function localClock(iso: string, timeZone: string): string {
  const at = new Date(iso);
  return `${utcToLocalInput(iso, timeZone).slice(11, 16)} ${zoneAbbreviation(timeZone, at)}`;
}

/** "Oct 21" in `timeZone`, or "Oct 21, 2026" with the year: the
 *  calendar day there, which an evening in Alaska does not share with
 *  UTC. */
export function localDate(
  iso: string,
  timeZone: string,
  { withYear = false }: { withYear?: boolean } = {},
): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
    timeZone,
  });
}

/** "Oct 21, 14:30 AKDT" for an instant, in `timeZone`. */
export function localDateTime(
  iso: string,
  timeZone: string,
  options: { withYear?: boolean } = {},
): string {
  if (Number.isNaN(new Date(iso).getTime())) return iso;
  return `${localDate(iso, timeZone, options)}, ${localClock(iso, timeZone)}`;
}

/** "= 19:30Z", what a typed local time is in UTC; "" until it parses. */
export function zuluHint(local: string, timeZone: string): string {
  const iso = localToUtcIso(local, timeZone);
  return iso ? `= ${iso.slice(11, 16)}Z ${iso.slice(0, 10)}` : "";
}

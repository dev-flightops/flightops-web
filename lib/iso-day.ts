/**
 * Calendar-day helpers that operate on "YYYY-MM-DD" strings.
 *
 * Why strings and not Date:
 *
 * A Date crossing the server/client boundary is an absolute instant. Both
 * sides then read calendar fields off it with local-time getters — but the
 * server runs UTC and the browser runs the viewer's zone. For any viewer at
 * a negative UTC offset (i.e. all of the Americas) the two disagree by a day.
 *
 * That is what broke the fleet board's day navigator: with ?d=2026-08-20 the
 * server sent the instant 2026-08-20T00:00Z, an Alaska browser read it back
 * as Aug 19, and so "next day" computed 19 + 1 = 20 and pushed the URL it was
 * already on. router.push to an unchanged URL is a no-op, so the forward
 * arrow did nothing while the back arrow still moved.
 *
 * Keeping the day as a string removes the instant — and with it the zone —
 * from the arithmetic entirely. UTC is used internally only as a fixed frame
 * for month-length and weekday rules; it never leaks into the result.
 */

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a well-formed "YYYY-MM-DD" that names a real calendar date. */
export function isValidIsoDay(raw: string | undefined | null): raw is string {
  if (!raw) return false;
  const m = ISO_DAY.exec(raw);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  // Round-trips only if the parts name a date that exists: Date.UTC rolls
  // 2026-02-30 forward to March 2, which fails this check.
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

/** The viewer's own local calendar day, as "YYYY-MM-DD". */
export function todayIsoDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Move an ISO day by whole days. Month, year and leap-day rollover come from
 * Date.UTC, so this is stable no matter where it runs.
 */
export function shiftIsoDay(iso: string, days: number): string {
  const m = ISO_DAY.exec(iso);
  if (!m) return iso;
  const shifted = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days),
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-` +
    `${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`
  );
}

/** Whole days from `from` to `to` — negative when `to` is earlier. */
export function isoDayDiff(from: string, to: string): number {
  const a = ISO_DAY.exec(from);
  const b = ISO_DAY.exec(to);
  if (!a || !b) return 0;
  const ms =
    Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])) -
    Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  return Math.round(ms / 86_400_000);
}

/** "Wed, Aug 19" — formatted in UTC so the string never shifts the date. */
export function formatIsoDay(iso: string): string {
  const m = ISO_DAY.exec(iso);
  if (!m) return iso;
  const at = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
  return at.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The navigator's label: "Today — Wed, Aug 19", or just the date when it is
 * far enough out that the relative wording stops helping.
 */
export function describeIsoDay(iso: string, todayIso: string): string {
  const label = formatIsoDay(iso);
  switch (isoDayDiff(todayIso, iso)) {
    case 0:
      return `Today — ${label}`;
    case 1:
      return `Tomorrow — ${label}`;
    case -1:
      return `Yesterday — ${label}`;
    default:
      return label;
  }
}

/**
 * Turn a "YYYY-MM-DD" into a Date anchored at UTC midnight.
 *
 * For callers that need a Date to hand to toLocaleDateString with their
 * own format options. Pair it with `timeZone: "UTC"` on the formatter and
 * the calendar date survives end to end.
 *
 * The reason this exists: `new Date("2026-08-26T00:00:00")` — no trailing
 * Z — parses in the RUNTIME's zone, and several pages then formatted the
 * result with `timeZone: "UTC"`. Parsed local, rendered UTC. On a server
 * east of Greenwich that renders the day before: a pay event dated the
 * 26th displayed as the 25th. It happens to be correct on a UTC host,
 * which is why it survived.
 *
 * Returns null on anything that is not a real calendar date, so callers
 * can render a dash rather than "Invalid Date".
 */
export function isoDayToUtcDate(iso: string | null | undefined): Date | null {
  if (!isValidIsoDay(iso)) return null;
  const m = ISO_DAY.exec(iso)!;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

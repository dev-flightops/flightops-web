/**
 * Flight-time formatting helpers.
 *
 * Dispatchers reference two clocks per flight: local field time
 * (AKD for the Peregrine demo tenant) and Zulu (UTC). The legacy
 * board shows both stacked as `08:36 AKD / 16:36z`. Matching the
 * format verbatim so muscle memory transfers.
 *
 * America/Anchorage automatically handles AKDT (UTC-8) vs AKST
 * (UTC-9) swap via Intl's IANA data — no manual DST logic needed.
 * In M3 when tenants outside Alaska come online, we'll source the
 * IANA zone from the tenant record; "America/Anchorage" is hard-
 * coded here for now.
 */

const AKD_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Anchorage",
});

/** "08:36 AKD" — local time at the field. */
export function formatLocal(iso: string): string {
  return `${AKD_FORMATTER.format(new Date(iso))} AKD`;
}

/** "16:36z" — Zulu time, lowercase z to match the legacy board. */
export function formatZulu(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}z`;
}

/** Both formats stacked, useful in tight table cells. */
export function formatBoth(iso: string): { local: string; zulu: string } {
  return { local: formatLocal(iso), zulu: formatZulu(iso) };
}

/**
 * "Aug 26, 00:13z" — a Zulu timestamp with the date, for lists where a
 * bare time would be ambiguous across midnight.
 *
 * Exists because three pages hand-rolled
 * `toLocaleTimeString(undefined, { hour, minute })` instead of reaching
 * for the helpers above. With no timeZone that renders in the *runtime's*
 * zone — the server's, on a server component — and with no suffix the
 * reader has no way to tell which clock they are looking at. Ramp Ops was
 * showing "05:15 PM" for what the rest of the app calls 17:15z.
 */
export function formatZuluDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${date}, ${formatZulu(iso)}`;
}

/** "Aug 7, 2026" — a UTC calendar date, for record dates that carry no
 *  meaningful time of day. Pinned so the day does not shift with the
 *  host's zone. */
export function formatZuluDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

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

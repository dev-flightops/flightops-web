import { NotBuiltPage } from "@/components/not-built-page";

/**
 * /maintenance/expiration — legacy
 * `templates/maintenance/expiration_report.html`.
 *
 * Parts Expiration Report — 4 stat cards (Expired · Next 30 Days ·
 * 31-60 Days · 61-90 Days) + 4 grouped tables by time band, each
 * with columns Part # · Description · Batch · Lot · Expires · Qty ·
 * Location.
 *
 * Backend not shipped — Marc's M2 maintenance-service parts
 * expiration roll-up query still to land. Rendering the shell with
 * all 4 stat cards + column headers; the tables show empty state
 * until data arrives.
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function ExpirationPage() {
  return (
    <NotBuiltPage
      title="Parts Expiration Report"
      summary="Parts expiring in the next 90 days, grouped by time band, with batch, lot and location."
    />
  );
}

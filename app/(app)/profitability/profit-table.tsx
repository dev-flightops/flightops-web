import type { ProfitRow } from "@/lib/api/reports";

/**
 * One breakdown — by route, or by aircraft.
 *
 * Legacy has two of these headed "Cost by Route" and "Cost by
 * Aircraft", with columns Flights, Flight Hours, Est Cost and Avg Cost
 * / Hr. No revenue, no profit, no margin. These carry all three,
 * which is why the headings differ: legacy's describe what legacy
 * computes.
 *
 * Presentational and separate from the page so it renders under
 * vitest, and because the empty-margin and per-row-gap cases are worth
 * testing rather than eyeballing.
 */

function money(cents: number): string {
  // Whole dollars. Cents on a monthly cost total are noise, and they
  // push a nine-column table sideways.
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function ProfitTable({
  caption,
  firstColumn,
  rows,
}: {
  caption: string;
  /** "Route" or "Aircraft". */
  firstColumn: string;
  rows: ProfitRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
        No flights on file for this period.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th scope="col" className="px-4 py-3">
              {firstColumn}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Flights
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Hours
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Revenue
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Cost
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Profit
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Margin
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              data-testid={`row-${r.label}`}
              className="border-b border-border last:border-0"
            >
              <td className="px-4 py-2.5 font-mono text-foreground">
                {r.label}
                {/* A row can be read against its own gaps rather than
                    the report's. Without this a route showing $0 cost
                    looks free rather than uncosted. */}
                {(r.unpriced > 0 || r.without_hours > 0) && (
                  <span
                    className="ml-2 text-[0.65rem] text-status-yellow"
                    title="These legs are missing a rate or a flight time, so this row is incomplete"
                  >
                    {r.unpriced > 0 && `${r.unpriced} uncosted`}
                    {r.unpriced > 0 && r.without_hours > 0 && ", "}
                    {r.without_hours > 0 && `${r.without_hours} untimed`}
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {r.flights}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {r.block_hours.toLocaleString("en-US")}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {money(r.revenue_cents)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {money(r.cost_cents)}
              </td>
              <td
                className={
                  "px-4 py-2.5 text-right tabular-nums " +
                  (r.profit_cents < 0 ? "text-status-red" : "text-foreground")
                }
              >
                {money(r.profit_cents)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {r.margin_pct === null ? (
                  <span
                    className="text-muted-foreground"
                    title="No revenue on this row, so there is no margin to take"
                  >
                    —
                  </span>
                ) : (
                  <span
                    className={
                      r.margin_pct < 0
                        ? "text-status-red"
                        : "text-foreground"
                    }
                  >
                    {r.margin_pct.toFixed(1)}%
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

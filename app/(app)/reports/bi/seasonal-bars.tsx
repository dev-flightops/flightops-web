import type { SeasonalMonth } from "@/lib/api/reports";

/**
 * Twelve months of demand, as bars.
 *
 * CSS heights rather than a charting library: this is one series of
 * twelve values, and a dependency that ships a canvas renderer to draw
 * twelve rectangles is a dependency to keep patched forever. It also
 * keeps the numbers in the DOM, so the figures are readable and
 * testable rather than painted.
 *
 * Every month in the window is rendered, including the empty ones. A
 * gap in a seasonal series is the information — an operator looking at
 * this wants to see the quiet months, and dropping them makes twelve
 * months look like two.
 */

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function SeasonalBars({ months }: { months: SeasonalMonth[] }) {
  const busiest = Math.max(1, ...months.map((m) => m.flights));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <ol className="flex items-end gap-1.5" style={{ height: "9rem" }}>
        {months.map((m) => {
          // A month that flew at all gets a visible bar, so one flight
          // in a quiet month does not round to nothing.
          const pct = m.flights > 0 ? Math.max(4, (m.flights / busiest) * 100) : 0;
          return (
            <li
              key={m.label}
              data-testid={`month-${m.year}-${m.month}`}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={
                m.flights === 0
                  ? `${m.label}: no flights`
                  : `${m.label}: ${m.flights} flights, ${m.pax} pax, ${money(m.revenue_cents)}`
              }
            >
              <span className="text-[0.6rem] tabular-nums text-muted-foreground">
                {m.flights > 0 ? m.flights : ""}
              </span>
              <div
                className={
                  "w-full rounded-t " +
                  (m.flights > 0 ? "bg-status-blue/70" : "bg-transparent")
                }
                style={{ height: `${pct}%` }}
                aria-hidden
              />
            </li>
          );
        })}
      </ol>
      <ol className="mt-1.5 flex gap-1.5">
        {months.map((m) => (
          <li
            key={m.label}
            className="flex-1 text-center text-[0.55rem] uppercase tracking-wide text-muted-foreground"
          >
            {/* Month only; the year is in the window line above the
                chart, and twelve "Mar 2026"s will not fit. */}
            {m.label.split(" ")[0]}
          </li>
        ))}
      </ol>

      <table className="mt-4 w-full text-xs">
        <caption className="sr-only">
          Flights, passengers, revenue and load factor by month
        </caption>
        <thead>
          <tr className="border-b border-border text-left text-[0.6rem] uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="py-1.5">
              Month
            </th>
            <th scope="col" className="py-1.5 text-right">
              Flights
            </th>
            <th scope="col" className="py-1.5 text-right">
              Pax
            </th>
            <th scope="col" className="py-1.5 text-right">
              Revenue
            </th>
            <th scope="col" className="py-1.5 text-right">
              Load factor
            </th>
          </tr>
        </thead>
        <tbody>
          {months
            .filter((m) => m.flights > 0)
            .map((m) => (
              <tr key={m.label} className="border-b border-border last:border-0">
                <td className="py-1.5 text-foreground">{m.label}</td>
                <td className="py-1.5 text-right tabular-nums text-foreground">
                  {m.flights}
                </td>
                <td className="py-1.5 text-right tabular-nums text-foreground">
                  {m.pax}
                </td>
                <td className="py-1.5 text-right tabular-nums text-foreground">
                  {money(m.revenue_cents)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {m.load_factor_pct === null ? (
                    <span
                      className="text-muted-foreground"
                      title={`No manifest filed on any of ${m.flights} flights, so load factor cannot be measured`}
                    >
                      —
                    </span>
                  ) : (
                    <span className="text-foreground">
                      {m.load_factor_pct.toFixed(1)}%
                      <span className="ml-1 text-[0.6rem] text-muted-foreground">
                        ({m.flights_with_manifest} of {m.flights})
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {months.every((m) => m.flights === 0) && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No flights in the last {months.length} months.
        </p>
      )}
    </div>
  );
}

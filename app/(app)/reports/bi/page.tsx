import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getBiDashboard, type BiDashboard } from "@/lib/api/reports";

import { SeasonalBars } from "./seasonal-bars";

/**
 * /reports/bi — the business-intelligence dashboard.
 *
 * Legacy's `templates/reports/bi_dashboard.html`, reached from its nav
 * as "BI". Four of its five metrics; the fifth is route
 * profitability, which is the /profitability report — so this page
 * links there rather than carrying a second copy of the same
 * arithmetic that could disagree with it.
 *
 * NO PERIOD CONTROL, DELIBERATELY
 *
 * Seasonal demand over a single month is not a pattern, so the
 * service reads a fixed trailing twelve months. A month picker that
 * one of four tables ignored would be worse than none, and this is
 * the only report here without one — which is why the window is
 * stated in words at the top rather than implied by a control.
 *
 * LOAD FACTOR CARRIES ITS DENOMINATOR
 *
 * Every load-factor figure shows how many flights filed a manifest
 * beside it, because that is the population it was measured over. A
 * flight with no manifest has seats and no passenger list; counting
 * it is how legacy reports an empty aircraft where the truth is
 * missing paperwork.
 */

export const dynamic = "force-dynamic";

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function Pct({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground" title="Not measurable">
        —
      </span>
    );
  }
  return <>{value.toFixed(1)}%</>;
}

const TH =
  "border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground";

export default async function BiPage() {
  let data: BiDashboard | null = null;
  let loadError: string | null = null;

  try {
    data = await getBiDashboard();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Business intelligence is limited to executive admins and the director of operations."
        : "Could not load the dashboard just now.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/reports"
        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← Reports
      </Link>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
        Business Intelligence
      </h1>
      {data && (
        <p className="mt-0.5 text-sm text-muted-foreground">
          {data.months} months to {data.window_end} · no period control,
          because seasonal demand needs the whole window
        </p>
      )}

      {loadError ? (
        <p
          role="alert"
          className="mt-5 rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : data ? (
        <>
          <p className="mt-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {data.advisory}
          </p>

          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Seasonal demand
          </h2>
          <SeasonalBars months={data.seasonal} />

          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Load factor by route
          </h2>
          {data.load_factor_by_route.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
              No flights in the window.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">Load factor by route</caption>
                <thead>
                  <tr className={TH}>
                    <th scope="col" className="px-4 py-3">
                      Route
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Flights
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Manifested
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Seats
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Pax
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Load factor
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Avg pax
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.load_factor_by_route.map((r) => (
                    <tr
                      key={r.route}
                      data-testid={`lf-${r.route}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 font-mono text-foreground">
                        {r.route}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.flights}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {/* The population the figure was measured
                            over. Called out in warning colour when it
                            is none of them, because that is the case
                            legacy reports as 0%. */}
                        <span
                          className={
                            r.flights_with_manifest === 0
                              ? "text-status-yellow"
                              : "text-foreground"
                          }
                        >
                          {r.flights_with_manifest}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.seats}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.pax}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        <Pct value={r.load_factor_pct} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.avg_pax_per_flight ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.load_factor_by_route.some(
            (r) => r.flights_with_manifest === 0,
          ) && (
            <p className="mt-2 text-xs text-status-yellow">
              A route showing no manifested flights has no load factor to
              report — not a load factor of zero. Its aircraft had seats and
              no passenger list on file.
            </p>
          )}

          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Revenue per block hour, by type
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Revenue and cost per block hour by aircraft type
              </caption>
              <thead>
                <tr className={TH}>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Flights
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Hours
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Revenue / hr
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Cost / hr
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Margin
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.revenue_per_hour_by_type.map((r) => (
                  <tr
                    key={r.aircraft_type}
                    data-testid={`rph-${r.aircraft_type}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-2.5 uppercase text-foreground">
                      {r.aircraft_type}
                      {(r.unpriced > 0 || r.without_hours > 0) && (
                        <span
                          className="ml-2 text-[0.65rem] text-status-yellow"
                          title="These legs are missing a rate or a duration, so this row is incomplete"
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
                      {r.revenue_per_hour_cents === null
                        ? "—"
                        : money(r.revenue_per_hour_cents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {r.cost_per_hour_cents === null
                        ? "—"
                        : money(r.cost_per_hour_cents)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      <Pct value={r.margin_pct} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Top customers
          </h2>
          {data.top_customers.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
              No bookings in the window.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Top customers by quoted revenue
                </caption>
                <thead>
                  <tr className={TH}>
                    <th scope="col" className="px-4 py-3">
                      Customer
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Revenue
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Bookings
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Average fare
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_customers.map((c) => (
                    <tr
                      key={c.customer_id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 text-foreground">
                        {/* /reservations/customers does not exist —
                            customer records are at /customers/[id].
                            This linked every name in the top-customers
                            table to a 404, invisible on the demo
                            tenant because the table is empty there. */}
                        <Link
                          href={`/customers/${c.customer_id}`}
                          className="text-status-blue hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {money(c.revenue_cents)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {c.bookings}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {c.avg_fare_cents === null
                          ? "—"
                          : money(c.avg_fare_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-5 text-xs text-muted-foreground">
            Margin by route lives on{" "}
            <Link
              href={data.profitability_path}
              className="text-status-blue hover:underline"
            >
              Profitability
            </Link>{" "}
            rather than here, so the two cannot disagree about the same
            number.
          </p>
        </>
      ) : null}
    </div>
  );
}

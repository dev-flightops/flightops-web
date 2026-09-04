import type { MorningBrief } from "@/lib/api/ai";

import { Donut, Gauge, Legend } from "./brief-charts";

/**
 * The morning brief, laid out to follow legacy's /ai/morning-brief.
 *
 * Same shape: title and date, alert banners across the top, then two
 * rows of four cards and a maintenance table underneath. Legacy's
 * first row is Flights / Fleet / Load Factor / On-Time and its second
 * is Revenue / Crew / Squawks / Safety; kept in that order, because
 * the order is the reading order somebody learns.
 *
 * Pure presentation — the page is a server component and everything
 * here takes the brief as a prop, so the whole layout renders under
 * vitest without mocking a fetch.
 *
 * `controls` comes in as a slot rather than being imported, because
 * the refresh button is a client component that calls useRouter and
 * useSearchParams. Importing it here would drag an app-router
 * invariant into every test of this layout, for a button none of them
 * are about.
 */

function Card({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col rounded-xl border border-border bg-card p-4"
    >
      <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-1 flex-col items-center justify-center">
        {children}
      </div>
      {footer ? (
        <div className="mt-2 text-center text-[0.65rem] text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function Big({
  value,
  tone = "",
}: {
  value: string;
  tone?: string;
}) {
  return (
    <span className={"text-3xl font-bold tabular-nums " + tone}>{value}</span>
  );
}

const TREND_MARK: Record<string, string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

const TREND_TONE: Record<string, string> = {
  up: "text-status-green",
  down: "text-status-red",
  flat: "text-muted-foreground",
};

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function BriefView({
  brief,
  operator,
  controls,
}: {
  brief: MorningBrief;
  operator: string;
  controls?: React.ReactNode;
}) {
  const {
    flights,
    fleet,
    load_factor,
    on_time,
    revenue,
    crew,
    squawks,
    safety,
    maintenance_due,
    alerts,
  } = brief;

  // The API sends an ISO day. Formatting it in the host's zone would
  // roll it back a day anywhere west of Greenwich, so the parts are
  // read straight out of the string — no Date, no zone to get wrong.
  const [y, m, d] = brief.generated_for.split("-").map(Number);
  const heading = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Morning Ops Brief</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {heading} · {operator}
          </p>
        </div>
        {controls}
      </header>

      {alerts.length > 0 ? (
        <div
          // Assertive: these are the reason somebody opened the page.
          role="alert"
          className="mb-4 flex flex-wrap gap-2"
        >
          {alerts.map((a) => (
            <span
              key={a.text}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-semibold " +
                (a.severity === "critical"
                  ? "border-status-red/40 bg-status-red/10 text-status-red"
                  : "border-status-yellow/40 bg-status-yellow/10 text-status-yellow")
              }
            >
              {a.severity === "critical" ? "▲ " : "● "}
              {a.text}
            </span>
          ))}
        </div>
      ) : (
        <p className="mb-4 rounded-lg border border-status-green/40 bg-status-green/10 px-3 py-1.5 text-xs font-semibold text-status-green">
          Nothing needs attention this morning.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Flights Today">
          <Donut
            segments={flights.segments}
            centerValue={flights.active}
            centerLabel="active"
          />
          <Legend segments={flights.segments} />
        </Card>

        <Card title="Fleet Status">
          <Donut
            segments={fleet.segments}
            centerValue={fleet.total}
            centerLabel="aircraft"
          />
          <Legend segments={fleet.segments} />
        </Card>

        <Card
          title="Load Factor"
          footer={`${load_factor.pax} pax / ${load_factor.seats} seats`}
        >
          <Gauge percent={load_factor.percent} />
        </Card>

        <Card
          title="On-Time (Yesterday)"
          footer={`${on_time.completed}/${on_time.total} flights on time`}
        >
          <div className="flex items-baseline gap-2">
            <Big value={`${on_time.percent}%`} />
            {on_time.trend ? (
              <span
                className={"text-lg " + TREND_TONE[on_time.trend]}
                // The arrow repeats the number's direction; the
                // percentage beside it is the accessible version.
                aria-hidden
              >
                {TREND_MARK[on_time.trend]}
              </span>
            ) : (
              <span className="text-[0.65rem] text-muted-foreground">
                no prior day
              </span>
            )}
          </div>
        </Card>

        <Card
          title="Revenue Today"
          footer={`${revenue.bookings} booking${revenue.bookings === 1 ? "" : "s"}`}
        >
          <Big value={money(revenue.booked_cents)} tone="text-status-green" />
        </Card>

        <Card title="Crew Status" footer={`${crew.total} on the roster`}>
          <div className="w-full space-y-1.5 text-xs">
            <CrewRow label="On duty" value={crew.on_duty} total={crew.total} />
            <CrewRow
              label="Not current"
              value={crew.non_current}
              total={crew.total}
              tone="bg-status-red"
            />
            <CrewRow
              label="In grace"
              value={crew.grace}
              total={crew.total}
              tone="bg-status-yellow"
            />
          </div>
        </Card>

        <Card
          title="Open Squawks"
          footer={squawks.open === 0 ? "All clear" : severityLine(squawks.by_severity)}
        >
          <Big
            value={String(squawks.open)}
            tone={squawks.open ? "text-status-yellow" : "text-status-green"}
          />
        </Card>

        <Card
          title="Safety Reports Open"
          footer={safety.open === 0 ? "All clear" : severityLine(safety.by_severity)}
        >
          <Big
            value={String(safety.open)}
            tone={safety.open ? "text-status-yellow" : "text-status-green"}
          />
        </Card>
      </div>

      <section
        aria-label="Maintenance due this week"
        className="mt-3 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Maintenance Due This Week ({maintenance_due.length})
        </h2>
        {maintenance_due.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No items due this week
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Tail
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Due
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {maintenance_due.map((item) => (
                  <tr
                    key={`${item.tail}-${item.item}`}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="px-2 py-1.5 font-semibold">{item.tail}</td>
                    <td className="px-2 py-1.5">{item.item}</td>
                    <td className="px-2 py-1.5 tabular-nums">{item.due}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={
                          item.overdue
                            ? "font-semibold text-status-red"
                            : "text-muted-foreground"
                        }
                      >
                        {item.overdue ? "Overdue" : "Due"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function severityLine(by: Record<string, number>): string {
  const parts = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([sev, n]) => `${n} ${sev}`);
  return parts.join(" · ");
}

function CrewRow({
  label,
  value,
  total,
  tone = "bg-status-blue",
}: {
  label: string;
  value: number;
  total: number;
  tone?: string;
}) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 flex-shrink-0 text-muted-foreground">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted/25">
        <span
          className={"block h-full rounded-full " + tone}
          // Zero stays invisible rather than showing a hairline that
          // reads as "some".
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="w-6 flex-shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

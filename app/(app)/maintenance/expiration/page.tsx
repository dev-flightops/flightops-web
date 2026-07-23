import Link from "next/link";

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
 */
export default function ExpirationPage() {
  const expired = 0;
  const exp30 = 0;
  const exp60 = 0;
  const exp90 = 0;
  const nothingExpiring = expired + exp30 + exp60 + exp90 === 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <Link
        href="/maintenance/inventory"
        className="mb-4 inline-block text-sm text-status-blue hover:underline"
      >
        ← Inventory
      </Link>
      <h1 className="mb-5 text-xl font-bold">Parts Expiration Report</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard value={expired} label="Expired" color="red" />
        <StatCard value={exp30} label="Next 30 Days" color="yellow" />
        <StatCard value={exp60} label="31-60 Days" color="blue" />
        <StatCard value={exp90} label="61-90 Days" color="green" />
      </div>

      {nothingExpiring ? (
        <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
          <p className="text-sm text-status-green">
            No parts with expiration dates in the next 90 days.
          </p>
        </div>
      ) : (
        <>
          <ExpirationTable label="EXPIRED — Do Not Install" count={expired} color="red" />
          <ExpirationTable label="Expiring Within 30 Days" count={exp30} color="yellow" />
          <ExpirationTable label="Expiring 31-60 Days" count={exp60} color="blue" />
          <ExpirationTable label="Expiring 61-90 Days" count={exp90} color="green" />
        </>
      )}
    </div>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: "red" | "yellow" | "blue" | "green";
}) {
  const valueCls = {
    red: "text-status-red",
    yellow: "text-status-yellow",
    blue: "text-status-blue",
    green: "text-status-green",
  }[color];
  const borderCls =
    value > 0
      ? {
          red: "border-status-red/40",
          yellow: "border-status-yellow/40",
          blue: "border-status-blue/40",
          green: "border-status-green/40",
        }[color]
      : "border-border";
  return (
    <div className={"rounded-lg border bg-card px-4 py-4 text-center " + borderCls}>
      <div className={"text-2xl font-bold " + valueCls}>{value}</div>
      <div className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function ExpirationTable({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: "red" | "yellow" | "blue" | "green";
}) {
  if (count === 0) return null;
  const headerCls = {
    red: "text-status-red",
    yellow: "text-status-yellow",
    blue: "text-status-blue",
    green: "text-status-green",
  }[color];
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-border bg-card">
      <div className={"border-b border-border px-4 py-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] " + headerCls}>
        {label} ({count})
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">Part #</th>
              <th scope="col" className="px-4 py-2 font-semibold">Description</th>
              <th scope="col" className="px-4 py-2 font-semibold">Batch</th>
              <th scope="col" className="px-4 py-2 font-semibold">Lot</th>
              <th scope="col" className="px-4 py-2 font-semibold">Expires</th>
              <th scope="col" className="px-4 py-2 font-semibold">Qty</th>
              <th scope="col" className="px-4 py-2 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                {count} record{count === 1 ? "" : "s"} — data loads from the maintenance-service expiration roll-up.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

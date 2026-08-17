import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { formatQuote, getPortalDashboard } from "@/lib/api/portal";

import { StatusBadge, formatDate } from "./portal-ui";

/**
 * /portal — the customer's view of their own charters.
 *
 * Mirrors legacy `templates/portal/charter/dashboard.html`: a table of
 * the customer's charter requests with reference, route, date and
 * status, plus the "not linked" panel when the signed-in account has no
 * matching customer record.
 *
 * Read-only. Legacy offers no booking, cancellation or change here, and
 * neither do we — a customer sees what operations has recorded, and
 * changes go through the operator.
 */

export const dynamic = "force-dynamic";

export default async function PortalPage() {
  let data;
  try {
    data = await getPortalDashboard();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <Shell>
        <div className="rounded-lg border border-status-red/40 bg-status-red/5 p-4">
          <p className="text-sm text-status-red">
            {status === 401
              ? "Your session expired — please sign in again."
              : "We couldn't load your flights just now. Please try again in a moment."}
          </p>
        </div>
      </Shell>
    );
  }

  // An unlinked account is an expected state, not an error: ops staff
  // create portal logins, and the customer record may not be linked yet.
  if (!data.profile.linked) {
    return (
      <Shell>
        <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/5 p-4">
          <p className="text-sm font-semibold text-status-yellow">
            Your account isn&apos;t linked to a customer profile yet
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Contact the operations team and they&apos;ll connect your login
            to your account.
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell name={data.profile.display_name}>
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No charter flights on file yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Passengers</th>
                <th className="px-4 py-3">Quote</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/${c.id}`}
                      className="font-mono text-status-blue hover:underline"
                    >
                      {c.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {c.origin_icao} → {c.destination_icao}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(c.requested_date)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.pax_count}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.quoted_total_cents != null
                      ? formatQuote(c.quoted_total_cents)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.total > data.items.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {data.items.length} of {data.total} flights.
        </p>
      )}
    </Shell>
  );
}

function Shell({
  children,
  name,
}: {
  children: React.ReactNode;
  name?: string | null;
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        My Charter Flights
      </h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        {name ?? "Your charter flights with Peregrine Flight Ops"}
      </p>
      {children}
    </div>
  );
}


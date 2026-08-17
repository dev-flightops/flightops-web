import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { formatQuote, getPortalCharter } from "@/lib/api/portal";

import { StatusBadge, formatDate } from "../portal-ui";

/**
 * /portal/[charterId] — one charter, as the customer sees it.
 *
 * Mirrors legacy `templates/portal/charter/flight_detail.html`:
 * reference, route, date, status, the passenger/cargo/aircraft grid and
 * the quote summary.
 *
 * The backend returns 404 — not 403 — for a charter belonging to
 * someone else, so a customer cannot learn that an id exists. This page
 * turns that into notFound() and never distinguishes the two cases.
 */

export const dynamic = "force-dynamic";

export default async function PortalCharterPage({
  params,
}: {
  params: Promise<{ charterId: string }>;
}) {
  const { charterId } = await params;

  let charter;
  try {
    charter = await getPortalCharter(charterId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/portal"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← My flights
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {charter.reference}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {charter.origin_icao} → {charter.destination_icao} ·{" "}
            {formatDate(charter.requested_date)}
            {charter.requested_time ? ` · ${charter.requested_time}` : ""}
          </p>
        </div>
        <StatusBadge status={charter.status} />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
        <Detail label="Passengers" value={String(charter.pax_count)} />
        <Detail label="Cargo" value={`${charter.cargo_lbs} lbs`} />
        <Detail
          label="Aircraft"
          value={charter.aircraft_type_requested ?? "To be assigned"}
        />
        {charter.return_date && (
          <Detail label="Return" value={formatDate(charter.return_date)} />
        )}
        {charter.special_requirements && (
          <div className="col-span-2 sm:col-span-3">
            <dt className="text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
              Special requirements
            </dt>
            <dd className="mt-1 text-sm text-foreground">
              {charter.special_requirements}
            </dd>
          </div>
        )}
      </dl>

      {charter.quoted_total_cents != null && (
        <div className="mb-5 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Quote
          </h2>
          <div className="flex items-baseline justify-between border-t border-border pt-2">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold text-status-green">
              {formatQuote(charter.quoted_total_cents)}
            </span>
          </div>
        </div>
      )}

      {/* Advisory only — there is no enforced cutoff, and nothing a
          customer can do here late enough for one to apply to. Legacy
          carries the same wording in its booking script. */}
      <p className="text-xs text-muted-foreground">
        Please plan to check in at least 30 minutes before your departure
        time. If you are checking bags, allow a little extra.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        To change or cancel this flight, contact the operations team.
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.65rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}

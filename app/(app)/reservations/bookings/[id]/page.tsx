import Link from "next/link";
import {
  formatZuluDate,
  formatZuluDateTime,
} from "@/lib/format/flight-time";
import { notFound, redirect } from "next/navigation";

import { linkCaps } from "@/components/ff/controls";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  getBooking,
} from "@/lib/api/reservations";

import { searchFlights, type FlightSearchResult } from "@/lib/api/flight-search";
import { loadZoneTable } from "@/lib/api/auth";
import { zoneFor } from "@/lib/format/local-time";
import { LoadFailedNotice } from "@/components/ff/setup-notice";
import { Loads } from "@/lib/api/loads";

import { AssignFlightPanel } from "./assign-flight-panel";
import { LifecycleControls } from "./lifecycle-controls";

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filed?: string; updated?: string }>;
}) {
  const { id } = await params;
  const { filed, updated } = await searchParams;

  let booking: Booking;
  try {
    booking = await getBooking(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  // Candidate flights on the booking's own route and day. Full ones
  // are included on purpose — a dispatcher looking at an unserviced
  // booking needs to see that the 09:15 exists and is full, which is a
  // different problem from there being no flight at all.
  // #138: a search that fails says so; it had read as no flight at all.
  const loads = new Loads();
  let candidates: FlightSearchResult[] = [];
  if (booking.status !== "cancelled") {
    candidates = await loads.or(
      searchFlights({
        origin: booking.origin_icao,
        destination: booking.destination_icao,
        date: booking.requested_departure_at.slice(0, 10),
        paxCount: booking.pax_count,
        showUnavailable: true,
      }).then((r) => r.items),
      // A search that fails should not take the page with it; the rest
      // of the booking is still worth reading.
      [],
      "the flights this booking could go on",
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/reservations" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Reservations
        </Link>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 page-title">
          {booking.origin_icao} → {booking.destination_icao}
          <span className="text-sm font-normal text-muted-foreground">
            {formatZuluDateTime(booking.requested_departure_at)}
          </span>
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          {BOOKING_STATUS_LABELS[booking.status]} · Filed{" "}
          {formatZuluDate(booking.created_at)} · Booking id{" "}
          <code className="rounded bg-muted/60 px-1 font-mono text-[0.7em]">
            {booking.id.slice(0, 8)}
          </code>
        </p>
      </header>

      <LoadFailedNotice what={loads.failed} className="mb-6" />

      {filed === "1" ? (
        <div
          role="status"
          className="mb-4 notice notice-green"
        >
          Booking filed.
        </div>
      ) : null}
      {updated === "1" ? (
        <div
          role="status"
          className="mb-4 notice notice-green"
        >
          Booking updated.
        </div>
      ) : null}

      <section className="mb-6 space-y-4 rounded-lg border border-border bg-card p-5">
        <DetailRow
          label="Customer"
          value={
            booking.customer.company_name
              ? `${booking.customer.full_name} — ${booking.customer.company_name}`
              : booking.customer.full_name
          }
          href={`/customers/${booking.customer.id}`}
        />
        <DetailRow
          label="Route"
          value={`${booking.origin_icao} → ${booking.destination_icao}`}
        />
        <DetailRow
          label="Departure"
          value={formatZuluDateTime(booking.requested_departure_at)}
        />
        {booking.estimated_arrival_at ? (
          <DetailRow
            label="Est. arrival"
            value={formatZuluDateTime(booking.estimated_arrival_at)}
          />
        ) : null}
        {booking.aircraft ? (
          <DetailRow
            label="Aircraft"
            value={`${booking.aircraft.tail_number}${booking.aircraft.model ? ` (${booking.aircraft.model})` : ""}`}
          />
        ) : (
          <DetailRow label="Aircraft" value="— (dispatch to assign)" />
        )}
        <DetailRow label="Pax" value={String(booking.pax_count)} />
        {booking.cargo_notes ? (
          <DetailRow label="Cargo" value={booking.cargo_notes} />
        ) : null}
        {booking.quoted_total_cents !== null ? (
          <DetailRow
            label="Quote"
            value={`$${(booking.quoted_total_cents / 100).toFixed(2)}`}
          />
        ) : null}
        {booking.notes ? (
          <div>
            <div className="eyebrow">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
              {booking.notes}
            </p>
          </div>
        ) : null}
      </section>

      {booking.confirmed_at ||
      booking.cancelled_at ||
      booking.completed_at ? (
        <section className="mb-6 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 eyebrow">
            Lifecycle history
          </h2>
          <ul className="space-y-2 text-xs">
            {booking.quoted_at ? (
              <li>
                <span className="font-semibold">Quoted</span> —{" "}
                {formatZuluDateTime(booking.quoted_at)}
              </li>
            ) : null}
            {booking.confirmed_at ? (
              <li>
                <span className="font-semibold">Confirmed</span> —{" "}
                {formatZuluDateTime(booking.confirmed_at)} by{" "}
                {booking.confirmed_by?.full_name ?? "unknown"}
              </li>
            ) : null}
            {booking.completed_at ? (
              <li>
                <span className="font-semibold">Completed</span> —{" "}
                {formatZuluDateTime(booking.completed_at)}
              </li>
            ) : null}
            {booking.cancelled_at ? (
              <li>
                <span className="font-semibold">Cancelled</span> —{" "}
                {formatZuluDateTime(booking.cancelled_at)} by{" "}
                {booking.cancelled_by?.full_name ?? "unknown"}
                {booking.cancelled_reason ? (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {booking.cancelled_reason}
                  </p>
                ) : null}
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      {/* Shown for a completed booking too, read-only in effect —
          which flight carried it is part of the record. Hidden only
          for a cancelled one, where there is nothing to service. */}
      {booking.status !== "cancelled" ? (
        <AssignFlightPanel
          bookingId={booking.id}
          candidates={candidates}
          timeZone={zoneFor(await loadZoneTable(), booking.origin_icao)}
          assignedFlightNumber={booking.flight?.flight_number ?? null}
          paxCount={booking.pax_count}
        />
      ) : null}

      {booking.status !== "completed" &&
      booking.status !== "cancelled" ? (
        <LifecycleControls
          bookingId={booking.id}
          currentStatus={booking.status}
          currentQuoteCents={booking.quoted_total_cents}
          cancelConfirmToken={`${booking.origin_icao}-${booking.destination_icao}`}
        />
      ) : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <span className="eyebrow">
        {label}
      </span>
      {href ? (
        <Link href={href} className="text-primary hover:underline">
          {value}
        </Link>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

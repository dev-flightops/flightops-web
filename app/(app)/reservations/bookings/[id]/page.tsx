import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  getBooking,
} from "@/lib/api/reservations";

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/reservations" className="hover:text-foreground">
            ← Reservations
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {booking.origin_icao} → {booking.destination_icao}
          <span className="text-sm font-normal text-muted-foreground">
            {new Date(booking.requested_departure_at).toLocaleString()}
          </span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {BOOKING_STATUS_LABELS[booking.status]} · Filed{" "}
          {new Date(booking.created_at).toLocaleDateString()} · Booking id{" "}
          <code className="rounded bg-muted/30 px-1 font-mono text-[0.7em]">
            {booking.id.slice(0, 8)}
          </code>
        </p>
      </header>

      {filed === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Booking filed.
        </div>
      ) : null}
      {updated === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
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
          value={new Date(booking.requested_departure_at).toLocaleString()}
        />
        {booking.estimated_arrival_at ? (
          <DetailRow
            label="Est. arrival"
            value={new Date(booking.estimated_arrival_at).toLocaleString()}
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
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
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
          <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Lifecycle history
          </h2>
          <ul className="space-y-2 text-xs">
            {booking.quoted_at ? (
              <li>
                <span className="font-semibold">Quoted</span> —{" "}
                {new Date(booking.quoted_at).toLocaleString()}
              </li>
            ) : null}
            {booking.confirmed_at ? (
              <li>
                <span className="font-semibold">Confirmed</span> —{" "}
                {new Date(booking.confirmed_at).toLocaleString()} by{" "}
                {booking.confirmed_by?.full_name ?? "unknown"}
              </li>
            ) : null}
            {booking.completed_at ? (
              <li>
                <span className="font-semibold">Completed</span> —{" "}
                {new Date(booking.completed_at).toLocaleString()}
              </li>
            ) : null}
            {booking.cancelled_at ? (
              <li>
                <span className="font-semibold">Cancelled</span> —{" "}
                {new Date(booking.cancelled_at).toLocaleString()} by{" "}
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

      {booking.status !== "completed" &&
      booking.status !== "cancelled" ? (
        <LifecycleControls
          bookingId={booking.id}
          currentStatus={booking.status}
          currentQuoteCents={booking.quoted_total_cents}
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
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      {href ? (
        <Link href={href} className="text-status-blue hover:underline">
          {value}
        </Link>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

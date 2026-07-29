import Link from "next/link";

import { LifecycleControls } from "@/app/(app)/reservations/bookings/[id]/lifecycle-controls";
import { ApiError } from "@/lib/api/client";
import { BOOKING_STATUS_LABELS, getBooking } from "@/lib/api/reservations";

import { SheetTitle } from "@/components/ui/sheet";

/** Server component rendering booking detail inside the Fleet Board drawer.
 *  Mirrors the standalone /reservations/bookings/{id} page structure but
 *  scoped to the sheet: header, Detail rows, lifecycle history, action
 *  controls, and an "Open full page" link for deep-linking / print. */
export async function BookingDrawerContent({ bookingId }: { bookingId: string }) {
  let booking;
  try {
    booking = await getBooking(bookingId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return <NotFoundBody />;
    }
    return <ErrorBody />;
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 pb-4 pt-6">
        <SheetTitle className="pr-8 text-xl">
          {booking.origin_icao} → {booking.destination_icao}
        </SheetTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {new Date(booking.requested_departure_at).toLocaleString()} ·{" "}
          {BOOKING_STATUS_LABELS[booking.status]}
        </p>
        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">
          Booking{" "}
          <code className="rounded bg-muted/30 px-1 font-mono">
            {booking.id.slice(0, 8)}
          </code>{" "}
          · Filed {new Date(booking.created_at).toLocaleDateString()} ·{" "}
          <Link
            href={`/reservations/bookings/${booking.id}`}
            className="text-status-blue hover:underline"
          >
            Open full page →
          </Link>
        </p>
      </header>

      <div className="space-y-5 px-6 py-5">
        <section className="space-y-3 rounded-lg border border-border bg-card p-4">
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
          <DetailRow
            label="Aircraft"
            value={
              booking.aircraft
                ? `${booking.aircraft.tail_number}${booking.aircraft.model ? ` (${booking.aircraft.model})` : ""}`
                : "— (dispatch to assign)"
            }
          />
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
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Lifecycle history
            </h2>
            <ul className="space-y-1.5 text-xs">
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

        {booking.status !== "completed" && booking.status !== "cancelled" ? (
          <LifecycleControls
            bookingId={booking.id}
            currentStatus={booking.status}
            currentQuoteCents={booking.quoted_total_cents}
          />
        ) : null}
      </div>
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
    <div className="grid grid-cols-[6rem_1fr] gap-2 text-sm">
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

function NotFoundBody() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 pb-4 pt-6">
        <SheetTitle className="pr-8 text-xl">Booking not found</SheetTitle>
      </header>
      <div className="px-6 py-5 text-sm text-muted-foreground">
        This booking may have been cancelled or removed. Refresh the Fleet
        Board and try again.
      </div>
    </div>
  );
}

function ErrorBody() {
  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 pb-4 pt-6">
        <SheetTitle className="pr-8 text-xl">Could not load booking</SheetTitle>
      </header>
      <div className="px-6 py-5 text-sm text-muted-foreground">
        Reservations service is unavailable right now. Try again in a moment.
      </div>
    </div>
  );
}

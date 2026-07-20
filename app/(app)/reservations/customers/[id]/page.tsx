import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  BOOKING_STATUS_LABELS,
  type Booking,
  type Customer,
  getCustomer,
  listBookings,
} from "@/lib/api/reservations";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = await searchParams;

  let customer: Customer;
  try {
    customer = await getCustomer(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  let history: Booking[] = [];
  try {
    history = (await listBookings({ customer_id: id, limit: 100 })).items;
  } catch {
    history = [];
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/reservations/customers" className="hover:text-foreground">
            ← Customers
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {customer.full_name}
          {customer.company_name ? (
            <span className="text-sm font-normal text-muted-foreground">
              {customer.company_name}
            </span>
          ) : null}
          {customer.archived_at ? (
            <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Archived
            </span>
          ) : null}
        </h1>
      </header>

      {created === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Customer created.
        </div>
      ) : null}

      <section className="mb-6 space-y-3 rounded-lg border border-border bg-card p-5">
        <DetailRow label="Email" value={customer.email ?? "—"} />
        <DetailRow label="Phone" value={customer.phone ?? "—"} />
        {customer.notes ? (
          <div>
            <div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Notes
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/90">
              {customer.notes}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-5">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Booking history
          </h2>
          {!customer.archived_at ? (
            <Link
              href={`/reservations/bookings/new?customer=${customer.id}`}
              className="rounded-md border border-status-blue bg-status-blue/15 px-2 py-1 text-[0.6875rem] font-semibold text-status-blue hover:bg-status-blue/20"
            >
              + New booking for this customer
            </Link>
          ) : null}
        </header>
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No bookings yet for this customer.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/reservations/bookings/${b.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm hover:bg-muted/10"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-baseline gap-2">
                      <span className="font-semibold">
                        {b.origin_icao} → {b.destination_icao}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        {new Date(
                          b.requested_departure_at,
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {BOOKING_STATUS_LABELS[b.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm">
      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </span>
      <span>{value}</span>
    </div>
  );
}

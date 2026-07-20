import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import { listCustomers } from "@/lib/api/reservations";

import { BookingForm } from "./booking-form";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: Promise<{
    customer?: string;
    origin?: string;
    destination?: string;
    date?: string;
    pax?: string;
  }>;
}) {
  const params = await searchParams;
  // Server-side prefetch: customers (searchable but a short seed list
  // is enough here) + active aircraft for the picker.
  let customers: Awaited<ReturnType<typeof listCustomers>>["items"] = [];
  let aircraft: Array<{ id: string; tail_number: string; model: string | null }> =
    [];
  try {
    customers = (await listCustomers({ limit: 500 })).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
  }
  try {
    const fleet = await getFleetAirworthiness();
    aircraft = fleet.items
      .filter((f) => f.is_active)
      .map((f) => f.aircraft);
  } catch {
    aircraft = [];
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/reservations" className="hover:text-foreground">
            ← Reservations
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          New Booking
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Assign a customer, route, and departure time. Aircraft and
          quote can be filled in later.
        </p>
      </header>

      {customers.length === 0 ? (
        <div className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow">
          No customers yet.{" "}
          <Link
            href="/reservations/customers/new"
            className="font-semibold underline"
          >
            Create one first
          </Link>{" "}
          before filing a booking.
        </div>
      ) : (
        <BookingForm
          customers={customers}
          aircraft={aircraft}
          preselectCustomerId={params.customer ?? null}
          prefill={{
            origin: params.origin ?? null,
            destination: params.destination ?? null,
            date: params.date ?? null,
            pax: params.pax ? Number(params.pax) || null : null,
          }}
        />
      )}
    </div>
  );
}

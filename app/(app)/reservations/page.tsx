import { ApiError } from "@/lib/api/client";
import { listCustomers } from "@/lib/api/reservations";

import { NewBookingSearchForm } from "./new-booking-search-form";

/**
 * /reservations — "New Booking" search form.
 *
 * Mirrors the legacy peregrineflight.com/reservations/ landing page:
 * a shopping-style search over trip type + adults/children + customer
 * + route + date. Legacy has a full seat-inventory / fare-class engine
 * behind it that serves a real "search flights" results table; we
 * don't have scheduled-flight inventory yet, so the Search CTA
 * pre-fills `/reservations/bookings/new` with the search params and
 * lets the dispatcher create the booking directly. When the
 * scheduled-flights + fares vertical lands (M4 story), the CTA
 * intercepts to render a results table first.
 *
 * Fleet-board view (day-grouped booking list) moved to
 * /reservations/fleet-board.
 */
export default async function NewBookingLandingPage() {
  let customers: Awaited<ReturnType<typeof listCustomers>>["items"] = [];
  try {
    customers = (await listCustomers({ limit: 500 })).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    customers = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <NewBookingSearchForm customers={customers} />
    </div>
  );
}

import { BookingForm } from "@/app/(app)/reservations/bookings/new/booking-form";
import { SheetTitle } from "@/components/ui/sheet";
import { ApiError } from "@/lib/api/client";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import { listCustomers } from "@/lib/api/reservations";

/** Async server component that fetches the customer + aircraft lists and
 *  renders BookingForm inside the Fleet Board sheet. Prefills:
 *    - aircraft_id from the empty-cell context (may be null for Unassigned)
 *    - date + time from the cell the user clicked
 *  and sets a redirect template that lands the operator back on the
 *  Fleet Board with the newly created booking's detail drawer open. */
export async function NewBookingDrawerContent({
  isoDay,
  hourText,
  aircraftId,
}: {
  isoDay: string;
  hourText: string;
  aircraftId: string | null;
}) {
  let customers: Awaited<ReturnType<typeof listCustomers>>["items"] = [];
  let aircraft: Array<{ id: string; tail_number: string; model: string | null }> =
    [];
  try {
    customers = (await listCustomers({ limit: 200 })).items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
  }
  try {
    const fleet = await getFleetAirworthiness();
    aircraft = fleet.items.filter((f) => f.is_active).map((f) => f.aircraft);
  } catch {
    aircraft = [];
  }

  const tailForHeader = aircraftId
    ? (aircraft.find((a) => a.id === aircraftId)?.tail_number ?? null)
    : null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-border px-6 pb-4 pt-6">
        <SheetTitle className="pr-8 text-xl">File Booking</SheetTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          {tailForHeader ? `${tailForHeader} · ` : "Unassigned · "}
          {isoDay} · {hourText}
        </p>
      </header>

      <div className="px-6 py-5">
        {customers.length === 0 ? (
          <div className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow">
            No customers yet. Add one from{" "}
            <a href="/customers/new" className="font-semibold underline">
              /customers/new
            </a>{" "}
            before filing a booking.
          </div>
        ) : (
          <BookingForm
            customers={customers}
            aircraft={aircraft}
            preselectCustomerId={null}
            preselectAircraftId={aircraftId}
            prefill={{
              origin: null,
              destination: null,
              date: `${isoDay}T${hourText}`,
              pax: null,
            }}
            redirectUrlTemplate={`/reservations/fleet-board?d=${isoDay}&booking=%NEWID%`}
          />
        )}
      </div>
    </div>
  );
}

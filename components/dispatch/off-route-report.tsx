import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LineOffRoute, OffRoute } from "@/lib/api/ops";
import { namesList } from "@/lib/flights/route-change-refusal";
import { bookingRef } from "@/lib/reservations/booking-ref";

const lbs = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n).toLocaleString("en-US")} lb` : `${value} lb`;
};

function lineText(line: LineOffRoute): string {
  const pieces = `${line.pieces} ${line.pieces === 1 ? "piece" : "pieces"}`;
  return `${line.description}, ${pieces}, ${lbs(line.weight_lbs)}: waiting at ${line.station} for ${line.destination}`;
}

/**
 * What an edit took off the route (#208), shown in the Edit dialog once it
 * saves. The client pulled PAVA from GVTripleStop for weather, and Ella
 * Ramirez, booked to PAVA, stayed on the whole flight: nothing put her
 * back on the board. Now her booking goes back to Awaiting a flight, mail
 * for the stop goes back to the waiting list, and this says so.
 */
export function OffRouteReport({
  flightNumber,
  offRoute,
  onClose,
}: {
  flightNumber: string;
  offRoute: OffRoute;
  onClose: () => void;
}) {
  const title = offRoute.stops.length
    ? `${flightNumber} no longer stops at ${namesList(offRoute.stops)}`
    : `${flightNumber}'s stops are in a new order`;
  const walkUps = offRoute.walk_ups;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          What the route no longer flies came off the flight. Nothing is sent to the passengers.
        </DialogDescription>
      </DialogHeader>
      <div role="status" className="space-y-4 text-sm">
        {offRoute.bookings.length > 0 && (
          <section aria-label="Back on Awaiting a flight">
            <h3 className="eyebrow mb-1">Back on Awaiting a flight</h3>
            <ul className="space-y-1">
              {offRoute.bookings.map((b) => {
                const others = b.passengers.filter((name) => name !== b.customer);
                return (
                  <li key={b.booking_id}>
                    <Link
                      href={`/reservations/bookings/${b.booking_id}`}
                      className="font-mono font-semibold underline"
                    >
                      {bookingRef(b.booking_id)}
                    </Link>
                    {` ${b.customer || namesList(b.passengers)}, ${b.origin} → ${b.destination}`}
                    {others.length > 0 && b.customer ? ` (${namesList(others)})` : ""}
                  </li>
                );
              })}
            </ul>
            <p className="mt-1 text-xs text-muted-foreground">
              Off this flight&apos;s manifest. Put them on another flight from Awaiting a flight on Dispatch.
            </p>
          </section>
        )}
        {offRoute.lines.length > 0 && (
          <section aria-label="Back on the waiting list">
            <h3 className="eyebrow mb-1">Back on the waiting list</h3>
            <ul className="space-y-1">
              {offRoute.lines.map((line) => (
                <li key={line.waiting_load_id + line.description}>{lineText(line)}</li>
              ))}
            </ul>
          </section>
        )}
        {walkUps.length > 0 && (
          <p role="alert" className="notice notice-yellow">
            {`${namesList(walkUps)} ${walkUps.length === 1 ? "was" : "were"} added on the manifest with no booking, so ${walkUps.length === 1 ? "stays" : "stay"} on it. Rebook them by hand, or take them off the manifest.`}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}

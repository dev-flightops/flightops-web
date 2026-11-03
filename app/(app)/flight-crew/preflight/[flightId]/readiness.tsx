import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { LoadStatusLine } from "@/components/load-teams/load-status";
import type { FlightLoad } from "@/lib/api/manifest";
import type { FlightAssignmentResponse, FuelOrderResponse } from "@/lib/api/types";

/**
 * Ready to go (#134), the client's pilot: "we're looking at fuel
 * complete, load complete, passengers checked in. We're ready to go."
 * One line each, from what the ramp, the fueler and the gate recorded.
 */

const FUEL: Record<string, { label: string; tone: StatusTone }> = {
  fueled: { label: "Fueled", tone: "green" },
  confirmed: { label: "Fuel confirmed", tone: "blue" },
  ordered: { label: "Fuel ordered", tone: "yellow" },
  discrepancy: { label: "Fuel discrepancy", tone: "red" },
};
const FUEL_ORDER = ["fueled", "confirmed", "ordered", "discrepancy"];

function fuelState(orders: FuelOrderResponse[]) {
  const live = orders.filter((o) => o.status !== "cancelled");
  for (const status of FUEL_ORDER) {
    const order = live.find((o) => o.status === status);
    if (order) {
      return {
        ...FUEL[status],
        detail: `${order.requested_quantity_gallons.toLocaleString()} gal ${order.fuel_type_label_snapshot}`,
      };
    }
  }
  return { label: "No fuel ordered", tone: "gray" as StatusTone, detail: null };
}

export function Readiness({
  fuelOrders,
  assignment,
  flightLoad,
  timeZone,
}: {
  fuelOrders: FuelOrderResponse[] | null;
  assignment: FlightAssignmentResponse | null | undefined;
  flightLoad: FlightLoad | null;
  timeZone: string;
}) {
  const fuel = fuelOrders ? fuelState(fuelOrders) : null;
  const booked = flightLoad
    ? flightLoad.checked_in.count + flightLoad.to_check_in.count
    : null;
  const checkedIn = flightLoad?.checked_in.count ?? null;
  return (
    <section aria-label="Ready to go" className="mb-6 border-y border-border py-3">
      <p className="eyebrow mb-2">Ready to go</p>
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        <li>
          <span className="block text-[0.7rem] text-muted-foreground">Fuel</span>
          {fuel ? (
            <>
              <StatusMark label={fuel.label} tone={fuel.tone} />
              {fuel.detail && (
                <>
                  {" "}
                  <span className="ml-1 text-xs text-muted-foreground">{fuel.detail}</span>
                </>
              )}
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          )}
        </li>
        <li>
          <span className="block text-[0.7rem] text-muted-foreground">Load</span>
          {assignment ? (
            <LoadStatusLine assignment={assignment} timeZone={timeZone} />
          ) : assignment === null ? (
            <StatusMark label="No load team" tone="gray" />
          ) : (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          )}
        </li>
        <li>
          <span className="block text-[0.7rem] text-muted-foreground">Passengers</span>
          {booked === null || checkedIn === null ? (
            <span className="text-xs text-muted-foreground">Unavailable</span>
          ) : booked === 0 ? (
            <StatusMark label="No passengers" tone="gray" />
          ) : (
            <StatusMark
              label={`${checkedIn} of ${booked} checked in`}
              tone={checkedIn === booked ? "green" : "yellow"}
            />
          )}
        </li>
      </ul>
    </section>
  );
}

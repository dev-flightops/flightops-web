import { FlightFuel } from "@/components/fuel/flight-fuel";
import { ApiError } from "@/lib/api/client";
import { listFuelOrders, listSupplierBases } from "@/lib/api/ground";
import type { FlightDetail, FuelOrderResponse } from "@/lib/api/types";
import {
  fuelTypeForAircraft,
  supplierOptionsFor,
  type FuelSupplierOption,
} from "@/lib/fuel";

import { EmptyPanel, SectionPanel } from "./section-panel";

/**
 * Fuel for the selected flight, on the dispatch packet: the aircraft's
 * fuel, the departure base's supplier and price, this flight's orders
 * with where each stands, and ordering or adjusting without leaving
 * the packet.
 *
 * The client, 27 Sep: "fuel ordering takes you to a different page and
 * then you lose all your work on the dispatch page when you go back."
 * The panel showed pricing and linked to /fuel/orders/new, which knew
 * nothing of the flight, and the packet's route, acknowledgements and
 * override flag lived only in its URL. Legacy ordered inline too: its
 * dispatch form carried the order and submitted it with the release.
 *
 * The same component is the pilot's fuel panel in preflight, so both
 * see the same orders (flightops-services migration 0103 links them to
 * the flight).
 */
export async function FuelOrderPanel({
  flight,
}: {
  flight: FlightDetail | null;
}) {
  if (!flight) {
    return (
      <EmptyPanel
        title="Fuel"
        hint="Pick a flight from the dropdown above to see its fuel orders and order fuel for it."
        accent="yellow"
      />
    );
  }

  const baseCode = flight.origin;
  const fuelTypeCode = fuelTypeForAircraft(flight.aircraft.model);

  const [basesResult, ordersResult] = await Promise.allSettled([
    listSupplierBases({ baseCode }),
    listFuelOrders({ flightId: flight.id }),
  ]);

  const failed = [basesResult, ordersResult].find((r) => r.status === "rejected");
  if (failed && failed.status === "rejected") {
    const status = failed.reason instanceof ApiError ? failed.reason.status : 0;
    return (
      <SectionPanel title="Fuel" accent="yellow">
        <p
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {status === 401
            ? "Session expired — sign in again to see fuel."
            : "Fuel unavailable — try refreshing in a moment."}
        </p>
      </SectionPanel>
    );
  }

  const options: FuelSupplierOption[] =
    basesResult.status === "fulfilled"
      ? supplierOptionsFor(basesResult.value.items, fuelTypeCode)
      : [];
  const orders: FuelOrderResponse[] =
    ordersResult.status === "fulfilled" ? ordersResult.value.items : [];
  const preferred = options[0] ?? null;

  return (
    <SectionPanel title="Fuel" accent="yellow">
      <dl className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Fuel type
          </dt>
          <dd className="font-mono text-foreground">
            {fuelTypeCode}{" "}
            <span className="font-sans text-muted-foreground">
              · auto from {flight.aircraft.model ?? "the aircraft"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Supplier at {baseCode}
          </dt>
          <dd className="text-foreground">{preferred?.supplierName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Price
          </dt>
          <dd className="font-mono text-foreground">
            {preferred?.pricePerGallon != null
              ? `$${preferred.pricePerGallon.toFixed(2)} / gal ${preferred.isContract ? "contract" : "spot"}`
              : "—"}
          </dd>
        </div>
      </dl>
      <FlightFuel
        flightId={flight.id}
        flightNumber={flight.flight_number}
        base={baseCode}
        source="dispatch"
        orders={orders}
        options={options}
        fuelTypeCode={fuelTypeCode}
      />
    </SectionPanel>
  );
}

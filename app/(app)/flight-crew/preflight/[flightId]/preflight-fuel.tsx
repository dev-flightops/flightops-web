import { FlightFuel } from "@/components/fuel/flight-fuel";
import type { FlightDetail, FuelOrderResponse } from "@/lib/api/types";
import type { FuelSupplierOption } from "@/lib/fuel";

/**
 * The pilot's view of the flight's fuel, on every preflight step.
 *
 * The client, 27 Sep: "The pilot needs to be able to order/review fuel
 * during the dispatch release process. So, if dispatch already ordered
 * fuel, pilot needs to see that. The pilot may also want to take
 * additional fuel so they might need to adjust or order more fuel."
 *
 * It is the dispatch packet's fuel component, so the pilot sees the
 * same orders dispatch placed, and whatever the pilot changes is logged
 * as the pilot's. Legacy had no pilot-side fuel at all.
 */
export function PreflightFuel({
  flight,
  orders,
  options,
  fuelTypeCode,
  unavailable,
}: {
  flight: FlightDetail;
  orders: FuelOrderResponse[];
  options: FuelSupplierOption[];
  fuelTypeCode: string;
  /** Set when the orders or suppliers could not be read. */
  unavailable: string | null;
}) {
  return (
    <section
      aria-labelledby="preflight-fuel-heading"
      className="mt-6 rounded-xl border border-border bg-card p-5"
    >
      <h2
        id="preflight-fuel-heading"
        className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
      >
        Fuel
      </h2>
      {unavailable ? (
        <p
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {unavailable}
        </p>
      ) : (
        <FlightFuel
          flightId={flight.id}
          flightNumber={flight.flight_number}
          base={flight.origin}
          source="pilot"
          orders={orders}
          options={options}
          fuelTypeCode={fuelTypeCode}
        />
      )}
    </section>
  );
}

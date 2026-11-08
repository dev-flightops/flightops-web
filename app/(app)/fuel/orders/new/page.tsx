import Link from "next/link";
import { auth } from "@/auth";
import { loadZoneTable } from "@/lib/api/auth";
import { localClock, localDay, zoneFor } from "@/lib/format/local-time";
import { FUEL_ORDERERS } from "@/lib/roles";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import { listFuelSuppliers, listFuelTypes } from "@/lib/api/ground";
import { listAircraft, listFlights } from "@/lib/api/ops";
import type {
  AircraftListItem,
  FlightListItem,
  FuelSupplierResponse,
  FuelTypeResponse,
} from "@/lib/api/types";

import { NewFuelOrderForm } from "./new-order-form";
import { routeText } from "@/lib/route";

/** The caller orders fuel only as a pilot: the services then take an
 *  order only for a flight the pilot crews, from that flight (#134). */
function orderingAsPilot(roles: readonly string[]): boolean {
  const orderer = roles.filter((r) => (FUEL_ORDERERS as ReadonlySet<string>).has(r));
  return orderer.length === 1 && orderer[0] === "pilot";
}

async function myFlights(): Promise<FlightListItem[]> {
  const days = [-1, 0, 1].map((offset) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  });
  const pages = await Promise.all(
    days.map((onDate) =>
      listFlights({ onDate, status: ["scheduled", "released"], assignedToMe: true, limit: 50 }),
    ),
  );
  const byId = new Map(pages.flatMap((p) => p.items).map((f) => [f.id, f]));
  return [...byId.values()].sort((a, b) => a.scheduled_departure_at.localeCompare(b.scheduled_departure_at));
}

export default async function NewFuelOrderPage() {
  const zonesPromise = loadZoneTable();
  if (orderingAsPilot((await auth())?.roles ?? [])) {
    const [flights, zones] = await Promise.all([myFlights().catch(() => null), zonesPromise]);
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link href="/fuel/orders" className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-4")}>
          <span aria-hidden>‹</span> Fuel Orders
        </Link>
        <h1 className="page-title mb-2">Order Fuel</h1>
        <p className="mb-6 border-b border-border pb-5 text-sm text-muted-foreground">
          A pilot orders fuel for a flight they fly, from the flight. Pick it:
        </p>
        {flights === null ? (
          <p role="alert" className="notice notice-yellow">
            Your flights couldn&apos;t be read. Open the flight on Flight Crew and order from its Fuel card.
          </p>
        ) : flights.length === 0 ? (
          <p className="notice notice-gray text-muted-foreground">
            You aren&apos;t crewed on a flight today. Once dispatch puts you on one, order its fuel from it.
          </p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {flights.map((f) => (
              <li key={f.id}>
                <Link
                  href={`/flight-crew/preflight/${f.id}`}
                  className="flex items-center justify-between gap-3 px-1 py-3 hover:bg-accent"
                >
                  <span>
                    <span className="font-mono font-semibold">{f.flight_number}</span>{" "}
                    {routeText(f)}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {f.aircraft?.tail_number} · departs {localClock(f.scheduled_departure_at, zoneFor(zones, f.origin))}
                    </span>
                  </span>
                  <span className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary">
                    Order fuel <span aria-hidden>›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  let suppliers: FuelSupplierResponse[] = [];
  let fuelTypes: FuelTypeResponse[] = [];
  let fleet: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const [s, t, a] = await Promise.all([listFuelSuppliers(), listFuelTypes(), listAircraft()]);
    suppliers = s.items;
    fuelTypes = t.items;
    // An order is for an aircraft in service (#156): the client's N208TW
    // wasn't in the fleet, and N301PA was grounded.
    fleet = a.items.filter((x) => x.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load the fuel directory. The form still works — pickers may be empty.";
  }

  const zones = await zonesPromise;
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/fuel/orders"
        className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-4")}
      >
        <span aria-hidden>‹</span> Fuel Orders
      </Link>
      <h1 className="page-title mb-6 border-b border-border pb-5">Order Fuel</h1>

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <NewFuelOrderForm suppliers={suppliers} fuelTypes={fuelTypes} fleet={fleet} today={localDay(zones.fallback)} />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        A supplier with a portal login sees the order there as soon as it&apos;s
        placed. Nothing else is sent: no email or text goes out, so call
        a supplier without one. Status flows ordered → confirmed → fueled.
      </p>
    </div>
  );
}

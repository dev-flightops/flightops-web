import {
  CrewCurrencyBanner,
  CrewLegalityHints,
} from "@/components/dispatch/packet/crew-status-rows";
import {
  FlightDetailsPanel,
  PacketStyles,
} from "@/components/dispatch/packet/flight-details-panel";
import { LeftColumn } from "@/components/dispatch/packet/left-column";
import { LoadFromSchedule } from "@/components/dispatch/packet/load-from-schedule";
import { PacketHeader } from "@/components/dispatch/packet/packet-header";
import { RightColumn } from "@/components/dispatch/packet/right-column";
import { SelectedFlightSummary } from "@/components/dispatch/packet/selected-flight-summary";
import { ApiError } from "@/lib/api/client";
import { listMyTenants } from "@/lib/api/auth";
import { getFlight, listAircraft, listFlights } from "@/lib/api/ops";
import type { AircraftListItem, FlightDetail } from "@/lib/api/types";
import { paramToRoute } from "@/lib/route";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

interface SearchParams {
  flight?: string;
  /** Comma-separated ICAOs that override [origin, destination] for the
   *  Weather panel. Set by the Route input on blur. */
  route?: string;
}

/**
 * /dispatch — pixel-match for the legacy `templates/dispatch/form.html`
 * "Flight Dispatch Packet" workflow.
 *
 * URL params:
 *   ?flight=<uuid>  — preselects a flight; the dropdown shows it as the
 *                     active option and the Flight Details panel pre-
 *                     populates with its data. Mirrors the legacy HTMX
 *                     pre-fill behaviour.
 */
export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { flight: selectedId, route: routeParam } = await searchParams;
  const today = todayUtc();

  const [{ items: flights }, tenantsResponse, selectedFlight] =
    await Promise.all([
      listFlights({ onDate: today }).catch(() => ({ items: [], total: 0 })),
      listMyTenants().catch(() => ({ tenants: [] })),
      selectedId ? loadFlight(selectedId) : Promise.resolve(null),
    ]);

  const currentTenant =
    tenantsResponse.tenants.find((t) => t.is_current) ??
    tenantsResponse.tenants[0];
  const tenantName = currentTenant?.name ?? "Peregrine Flight Ops";

  // Aircraft list is only needed by the Edit dialog inside RightColumn's
  // FlightActionsPanel — fetch it lazily, and only when a scheduled
  // flight is selected. Soft-fail if the call errors (the dialog hides
  // its tail-swap selector when the list is empty).
  let aircraft: AircraftListItem[] = [];
  if (selectedFlight?.status === "scheduled") {
    try {
      aircraft = (await listAircraft()).items;
    } catch {
      aircraft = [];
    }
  }

  // Resolve the routing for the Weather panel:
  //   1. `?route=PADU,PAUN,PAGM` if set (dispatcher typed something)
  //   2. [origin, destination] from the selected flight as a fallback
  //   3. empty array (panel shows the placeholder)
  const routedIcaos = paramToRoute(routeParam);
  const icaos =
    routedIcaos.length > 0
      ? routedIcaos
      : selectedFlight
        ? [selectedFlight.origin, selectedFlight.destination]
        : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PacketHeader tenantName={tenantName} />
      <PacketStyles />

      <div className="space-y-4">
        <LoadFromSchedule flights={flights} selectedFlightId={selectedId ?? null}>
          {selectedFlight && <SelectedFlightSummary flight={selectedFlight} />}
        </LoadFromSchedule>

        <FlightDetailsPanel flight={selectedFlight} />

        <CrewLegalityHints />

        {/* Crew-currency status only makes sense once a PIC is loaded.
            Selecting a flight pulls the demo PIC ("Brian Larson"), so we
            render the CLEAR banner only after that. Matches the legacy
            where the banner appears post-selection, not as a static row. */}
        {selectedFlight && <CrewCurrencyBanner />}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LeftColumn flight={selectedFlight} icaos={icaos} />
          <RightColumn flight={selectedFlight} aircraft={aircraft} />
        </div>
      </div>
    </div>
  );
}

/**
 * Returns null instead of throwing when the flight isn't found (stale
 * URL params). Anything else (auth failure, 500) re-throws so the layout
 * can surface it.
 */
async function loadFlight(flightId: string): Promise<FlightDetail | null> {
  try {
    return await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

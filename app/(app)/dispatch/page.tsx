import { CrewLegalityHints } from "@/components/dispatch/packet/crew-status-rows";
import { DispatchComplianceGate } from "@/components/dispatch/packet/dispatch-compliance-gate";
import { parseAckedMelIds } from "@/components/dispatch/packet/mel-acks";
import { OpenMelPanel } from "@/components/dispatch/packet/open-mel-panel";
import {
  FlightDetailsPanel,
  PacketStyles,
} from "@/components/dispatch/packet/flight-details-panel";
import { LeftColumn } from "@/components/dispatch/packet/left-column";
import { CrewPanel } from "@/components/dispatch/packet/crew-panel";
import { LoadFromSchedule } from "@/components/dispatch/packet/load-from-schedule";
import { PacketHeader } from "@/components/dispatch/packet/packet-header";
import { RightColumn } from "@/components/dispatch/packet/right-column";
import { SelectedFlightSummary } from "@/components/dispatch/packet/selected-flight-summary";
import { ApiError } from "@/lib/api/client";
import { listMyTenants } from "@/lib/api/auth";
import { listFlightCrew } from "@/lib/api/crew-assignments";
import {
  getComplianceBoard,
  getFlight,
  getPicCompliance,
  listAircraft,
  listFlights,
} from "@/lib/api/ops";
import { getRouteFreshness } from "@/lib/api/weather";
import type {
  AircraftListItem,
  FlightDetail,
  PicComplianceResponse,
  RouteFreshness,
} from "@/lib/api/types";
import type { PicOption } from "@/components/dispatch/packet/pic-picker";
import { parseAckedWarns } from "@/components/dispatch/packet/soft-warning-ack-parser";
import { parseAckedIcaos } from "@/components/dispatch/packet/notam-acks";
import { computeHardBlockReason } from "@/components/dispatch/packet/release-gate";
import { paramToRoute } from "@/lib/route";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_RE.test(value);
}

interface SearchParams {
  flight?: string;
  /** Comma-separated ICAOs that override [origin, destination] for the
   *  Weather panel. Set by the Route input on blur. */
  route?: string;
  /** Comma-separated ICAOs the dispatcher has manually acknowledged
   *  NOTAMs for. Bridges until the M2-M-4 NOTAM proxy ships. */
  notams_acked?: string;
  /** Comma-separated MEL ids the dispatcher has acknowledged on this
   *  packet (Spec 7). Mirrors the NOTAM-ack pattern — URL-driven so
   *  state survives reload + can be shared. */
  mels_acked?: string;
  /** Pilot UUID to render the Spec 5 compliance gate against. */
  pic?: string;
  /** M2-G-5 tail — comma-separated currency-item codes the dispatcher
   *  has ack'd (soft warnings). URL-driven so state persists reload. */
  warns_acked?: string;
  /** M2-G-5 tail — set to "1" after the supervisor override modal
   *  submits successfully. Signals the page to let Generate PDF fire
   *  even though hard blocks are on the pilot's currency record. */
  overrides_ack?: string;
  /** HALT-2 — set to "1" once the dispatcher acknowledges stale or
   *  missing route weather. URL-driven like the other acks so the state
   *  survives a reload. The release endpoint re-checks server-side, so
   *  hand-editing this only skips the button hint, not the gate. */
  stale_wx_ack?: string;
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
  const {
    flight: selectedId,
    route: routeParam,
    notams_acked: notamsAckedParam,
    mels_acked: melsAckedParam,
    pic: picOverrideId,
    warns_acked: warnsAckedParam,
    overrides_ack: overridesAckParam,
    stale_wx_ack: staleWxAckParam,
  } = await searchParams;
  const today = todayUtc();

  const currentPicId = isUuid(picOverrideId) ? picOverrideId : null;

  const [
    { items: flights },
    tenantsResponse,
    selectedFlight,
    picOptions,
    picCompliance,
    crew,
  ] = await Promise.all([
    listFlights({ onDate: today }).catch(() => ({ items: [], total: 0 })),
    listMyTenants().catch(() => ({ tenants: [] })),
    selectedId ? loadFlight(selectedId) : Promise.resolve(null),
    loadPicRoster(),
    currentPicId ? loadPicCompliance(currentPicId) : Promise.resolve(null),
    // Soft-fail: a crew roster that will not load should cost the
    // dispatcher the crew panel, not the whole packet. Everything else
    // on this page still works without it.
    selectedId
      ? listFlightCrew(selectedId).catch(() => ({ items: [], has_pic: false }))
      : Promise.resolve({ items: [], has_pic: false }),
  ]);

  // M2-G-5 tail — parse ack state from URL. `warns_acked` is
  // comma-separated currency-item codes; `overrides_ack=1` means the
  // supervisor override modal already ran successfully.
  // The assigned PIC is the PIC. `?pic=` stays as a fallback so a
  // hand-filled packet (no flight loaded, nothing to assign to) and old
  // shared links keep pre-screening, but where a real assignment exists
  // it wins — otherwise a stale link could have the compliance gate
  // describing someone who is not on the flight.
  const assignedPicId =
    crew.items.find((a) => a.crew_role === "pic")?.user.id ?? null;
  const effectivePicId = assignedPicId ?? currentPicId;

  const ackedWarnCodes = parseAckedWarns(warnsAckedParam);
  const overridesAcknowledged = overridesAckParam === "1";
  const staleWeatherAcknowledged = staleWxAckParam === "1";

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
  const notamAckedIcaos = parseAckedIcaos(notamsAckedParam);
  const ackedMelIds = parseAckedMelIds(melsAckedParam);
  const icaos =
    routedIcaos.length > 0
      ? routedIcaos
      : selectedFlight
        ? [selectedFlight.origin, selectedFlight.destination]
        : [];

  // HALT-2 — weather staleness for the routed stops. Soft-fails to null:
  // the release endpoint runs the same evaluator server-side, so a
  // weather-service blip degrades the button hint rather than stranding
  // every release. `computeHardBlockReason` documents that contract.
  let weatherFreshness: RouteFreshness | null = null;
  if (selectedFlight && icaos.length > 0) {
    weatherFreshness = await getRouteFreshness(icaos).catch(() => null);
  }

  // The Generate-PDF release gate (PIC currency, NOTAM acks, stale
  // weather) lives in one pure, unit-tested function so the precedence
  // rules can't drift.
  const hardBlockReason = computeHardBlockReason({
    picCompliance,
    ackedWarnCodes,
    overridesAcknowledged,
    hasSelectedFlight: selectedFlight !== null,
    icaos,
    notamAckedIcaos,
    weatherFreshness,
    staleWeatherAcknowledged,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PacketHeader tenantName={tenantName} flight={selectedFlight} />
      <PacketStyles />

      <div className="space-y-4">
        <LoadFromSchedule flights={flights} selectedFlightId={selectedId ?? null}>
          {selectedFlight && (
            <SelectedFlightSummary
              flight={selectedFlight}
              picName={
                crew.items.find((a) => a.crew_role === "pic")?.user
                  .full_name ?? null
              }
            />
          )}
        </LoadFromSchedule>

        <FlightDetailsPanel
          flight={selectedFlight}
          picOptions={picOptions}
          currentPicId={effectivePicId}
          flightId={selectedFlight?.id ?? null}
        />

        {/* Crew for this flight. Sits directly under Flight Details
            because the PIC dropdown up there is what a dispatcher
            reaches for first — this is where that choice becomes a row
            someone else can see. Only meaningful once a flight is
            selected; there is nothing to crew otherwise. */}
        {selectedFlight && (
          <CrewPanel
            flightId={selectedFlight.id}
            assignments={crew.items}
            candidates={picOptions}
          />
        )}

        <CrewLegalityHints />

        {/* Crew-currency status only makes sense once a PIC is loaded.
            The PIC selection lives in the URL as `?pic=<uuid>`; the
            picker inside FlightDetailsPanel writes it. The compliance
            data is fetched once at the page level and shared with the
            gate + the Generate-PDF hard-block guard. */}
        {selectedFlight && (
          <DispatchComplianceGate
            pilotUserId={effectivePicId}
            prefetched={picCompliance}
            ackedWarnCodes={ackedWarnCodes}
            flightId={selectedFlight.id}
            overridesAcknowledged={overridesAcknowledged}
          />
        )}

        {/* Open MEL items on the selected aircraft — Spec 7. Each item
            gets a dispatcher ack checkbox; state persists in the URL
            (?mels_acked=) so reload + share preserve it. */}
        {selectedFlight && (
          <OpenMelPanel
            aircraftId={selectedFlight.aircraft.id}
            ackedMelIds={ackedMelIds}
          />
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <LeftColumn
            flight={selectedFlight}
            icaos={icaos}
            notamAckedIcaos={notamAckedIcaos}
            weatherFreshness={weatherFreshness}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
          />
          <RightColumn
            flight={selectedFlight}
            aircraft={aircraft}
            hardBlockReason={hardBlockReason}
            pilotUserId={effectivePicId}
            overridesAcknowledged={overridesAcknowledged}
            notamAckedIcaos={notamAckedIcaos}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
          />
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

/**
 * M2-G-5 — load the pilot roster + per-pilot overall status for the
 * PIC dropdown. Reuses the compliance board endpoint since it already
 * returns `rows[].pilot` + `rows[].overall_status` in one call.
 *
 * Soft-fail on any error — the picker degrades to "No pilots on
 * roster" rather than blocking the whole dispatch page. Non-chief-
 * pilot users see the same shape (the endpoint doesn't gate by role
 * for the pilot listing).
 */
async function loadPicRoster(): Promise<PicOption[]> {
  try {
    const board = await getComplianceBoard();
    return board.rows.map((r) => ({
      pilot: r.pilot,
      status: r.overall_status,
    }));
  } catch {
    return [];
  }
}

/** M2-G-5 — soft-fail wrapper around getPicCompliance. Null on any
 *  error so the compliance gate can render its friendly banner. */
async function loadPicCompliance(
  pilotId: string,
): Promise<PicComplianceResponse | null> {
  try {
    return await getPicCompliance(pilotId);
  } catch {
    return null;
  }
}

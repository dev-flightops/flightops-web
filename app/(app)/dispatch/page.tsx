import { CrewLegalityHints } from "@/components/dispatch/packet/crew-status-rows";
import { auth } from "@/auth";
import {
  AIRWORTHINESS_WRITERS,
  DISPATCH_WRITERS,
  hasAnyRole,
  OVERRIDE_AUTHORITY,
} from "@/lib/roles";
import { DispatchComplianceGate } from "@/components/dispatch/packet/dispatch-compliance-gate";
import { parseAckedMelIds } from "@/components/dispatch/packet/mel-acks";
import { OpenMelPanel } from "@/components/dispatch/packet/open-mel-panel";
import { BookingsAwaitingFlightPanel } from "@/components/dispatch/packet/bookings-awaiting-flight-panel";
import { WeightReturnsPanel } from "@/components/dispatch/packet/weight-returns-panel";
import {
  FlightDetailsPanel,
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
  type CrewSeat,
  getComplianceBoard,
  getFlight,
  getPicCompliance,
  listAircraft,
  listFlights,
  listWeightReturns,
} from "@/lib/api/ops";
import { listBookings } from "@/lib/api/reservations";
import { getTypeQualificationGrid } from "@/lib/api/type-qualifications";
import {
  getAreaForecastRegions,
  loadDispatchRisk,
  type AreaForecastRegion,
  type DispatchRisk,
} from "@/lib/api/dispatch-risk";
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
import { typeWarnings } from "@/components/dispatch/packet/type-warnings";
import {
  computeHardBlockReason,
  overridesOnRecord,
} from "@/components/dispatch/packet/release-gate";
import { flightStops, paramToRoute } from "@/lib/route";

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
  /** Day of the schedule to work, `YYYY-MM-DD` UTC. Defaults to today.
   *
   *  The packet used to be pinned to today with no way to move, so a
   *  flight built for tomorrow could not be selected, crewed or
   *  released from here at all — the client's 9/9 report. Dispatch
   *  plans ahead; the day has to be a control. */
  date?: string;
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
    date: dateParam,
    route: routeParam,
    notams_acked: notamsAckedParam,
    mels_acked: melsAckedParam,
    pic: picOverrideId,
    warns_acked: warnsAckedParam,
    stale_wx_ack: staleWxAckParam,
  } = await searchParams;
  // What the viewer may do on the packet, not what they may see: the
  // backend enforces each of these, so this only keeps controls away
  // from people it would refuse.
  const viewerRoles = (await auth())?.roles ?? [];
  // Validate rather than trust: a malformed ?date= would otherwise be
  // passed to the API as a filter and quietly return nothing, which
  // reads as "no flights" rather than "bad date".
  const scheduleDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayUtc();

  const currentPicId = isUuid(picOverrideId) ? picOverrideId : null;

  // The crew roster is loaded before the compliance check, because the
  // check has to run against whoever is actually assigned. Everything
  // else still loads in parallel below.
  //
  // Soft-fail: a roster that will not load should cost the dispatcher
  // the crew panel, not the whole packet.
  const crew = selectedId
    ? await listFlightCrew(selectedId).catch(() => ({
        items: [],
        has_pic: false,
      }))
    : { items: [], has_pic: false };

  // The assigned PIC is the PIC. `?pic=` stays as a fallback so a
  // hand-filled packet (no flight loaded, nothing to assign to) and old
  // shared links keep pre-screening, but where a real assignment exists
  // it wins — otherwise a stale link could have the compliance gate
  // describing someone who is not on the flight.
  //
  // This used to be computed *after* the fetch below, which then ran
  // against `currentPicId` — the URL parameter alone. So assigning a
  // PIC properly and reloading the page left the gate reporting
  // "Compliance check unavailable" about a pilot it could see on the
  // roster, and the release could not be evaluated. The comment above
  // described the intent; the fetch did not implement it.
  const assignedPicId =
    crew.items.find((a) => a.crew_role === "pic")?.user.id ?? null;
  const effectivePicId = assignedPicId ?? currentPicId;
  // Anyone in the SIC seat is checked for that seat. None on a
  // single-pilot flight, which is the case the client reported: the PIC
  // was asked to acknowledge their own SIC counters with no SIC aboard.
  const sicIds = crew.items
    .filter((a) => a.crew_role === "sic")
    .map((a) => a.user.id);

  const [
    { items: flights },
    tenantsResponse,
    selectedFlight,
    picOptions,
    picCompliance,
    weightReturns,
    awaitingFlight,
    sicChecks,
  ] = await Promise.all([
    listFlights({ onDate: scheduleDate }).catch(() => ({
      items: [],
      total: 0,
    })),
    listMyTenants().catch(() => ({ tenants: [] })),
    selectedId ? loadFlight(selectedId) : Promise.resolve(null),
    loadPicRoster(),
    // Against whoever is actually flying it, not whoever the URL says.
    effectivePicId
      ? loadPicCompliance(effectivePicId, "pic", selectedId ?? null)
      : Promise.resolve(null),
    // Flights handed back over weight. Soft-fail like the crew roster —
    // but note the consequence differs: a failure here hides flights that
    // are already blocked server-side at preflight step 2, so nothing
    // becomes dispatchable that shouldn't be. It just means dispatch has
    // to hear about it by radio, as they do today.
    listWeightReturns().catch(() => ({ items: [] })),
    // Reservations nobody has put on a flight yet. Soft-fail like the
    // others: losing this panel costs dispatch the queue, not the
    // packet they are working on.
    listBookings({ awaiting_flight: true, limit: 25 }).catch(() => ({
      items: [],
      total: 0,
    })),
    Promise.all(
      sicIds.map(async (pilotId) => ({
        pilotId,
        // Asked about the flight, so it also reports the SIC's standing
        // on the aircraft type (#46).
        compliance: await loadPicCompliance(pilotId, "sic", selectedId ?? null),
      })),
    ),
  ]);

  // #46 — who is current in which seat on this flight's aircraft type,
  // for the PIC picker and the crew panel. Soft-fail: losing it costs
  // the warnings, and release still checks the PIC.
  const flightType = selectedFlight?.aircraft.airframe_type ?? null;
  const typeGrid = flightType
    ? await getTypeQualificationGrid().catch(() => null)
    : null;
  const warnings = typeWarnings(typeGrid, flightType);
  const candidates = picOptions.map((option) => ({
    ...option,
    typeWarning: warnings.get(option.pilot.id) ?? null,
  }));

  // M2-G-5 tail — parse ack state from URL. `warns_acked` is
  // comma-separated currency-item codes.
  const ackedWarnCodes = parseAckedWarns(warnsAckedParam);
  // Overridden when every PIC hard block has a supervisor override on
  // record for this flight. It used to be `?overrides_ack=1`, set by the
  // dialog in the browser that recorded it; since the supervisor
  // records it from their own login (29 Sep), the dispatcher's page has
  // to read it from the record.
  const overridesAcknowledged = overridesOnRecord(picCompliance);
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
  //   2. the selected flight's stops: every airport on a multi-leg
  //      route, else origin and destination
  //   3. empty array (panel shows the placeholder)
  const routedIcaos = paramToRoute(routeParam);
  const notamAckedIcaos = parseAckedIcaos(notamsAckedParam);
  const ackedMelIds = parseAckedMelIds(melsAckedParam);
  const icaos =
    routedIcaos.length > 0
      ? routedIcaos
      : selectedFlight
        ? flightStops(selectedFlight)
        : [];

  // HALT-2 — weather staleness for the routed stops. Soft-fails to null:
  // the release endpoint runs the same evaluator server-side, so a
  // weather-service blip degrades the button hint rather than stranding
  // every release. `computeHardBlockReason` documents that contract.
  let weatherFreshness: RouteFreshness | null = null;
  if (selectedFlight && icaos.length > 0) {
    weatherFreshness = await getRouteFreshness(icaos).catch(() => null);
  }

  // The dispatch risk matrix (#50): scored by ops from the flight's weather
  // and airport data, which loadDispatchRisk gathers. Both columns use it:
  // the left for the dispatcher's inputs, the right for the matrix.
  // Soft-fails: the page still works without it, and says so.
  let risk: DispatchRisk | null = null;
  let areaForecastRegions: AreaForecastRegion[] = [];
  if (selectedFlight) {
    [risk, areaForecastRegions] = await Promise.all([
      loadDispatchRisk(selectedFlight.id, flightStops(selectedFlight)).catch(() => null),
      getAreaForecastRegions().catch(() => []),
    ]);
  }
  const canEditRisk = hasAnyRole(viewerRoles, DISPATCH_WRITERS);

  // The Generate-PDF release gate (PIC currency, NOTAM acks, stale
  // weather) lives in one pure, unit-tested function so the precedence
  // rules can't drift.
  const hardBlockReason = computeHardBlockReason({
    picCompliance,
    sicCompliance: sicChecks.flatMap((c) => (c.compliance ? [c.compliance] : [])),
    ackedWarnCodes,
    overridesAcknowledged,
    hasSelectedFlight: selectedFlight !== null,
    picAssigned: assignedPicId !== null,
    icaos,
    notamAckedIcaos,
    weatherFreshness,
    staleWeatherAcknowledged,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PacketHeader tenantName={tenantName} flight={selectedFlight} />

        {/* Held-back flights sit above the packet on purpose: each one is
            already blocked at preflight step 2 and stays blocked until
            dispatch re-plans the load. Renders nothing when the list is
            empty. */}
        <WeightReturnsPanel returns={weightReturns.items} />

        {/* Behind, not blocked — see the panel for why it is amber
            rather than red. */}
        <BookingsAwaitingFlightPanel bookings={awaitingFlight.items} />

      <div className="space-y-4">
        <LoadFromSchedule
          flights={flights}
          selectedFlightId={selectedId ?? null}
          date={scheduleDate}
        >
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
          picOptions={candidates}
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
            candidates={candidates}
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
            sicChecks={sicChecks}
            canOverride={hasAnyRole(viewerRoles, OVERRIDE_AUTHORITY)}
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
            canSignOffMaintenance={hasAnyRole(viewerRoles, AIRWORTHINESS_WRITERS)}
            risk={risk}
            areaForecastRegions={areaForecastRegions}
            canEditRisk={canEditRisk}
          />
          <RightColumn
            flight={selectedFlight}
            aircraft={aircraft}
            hardBlockReason={hardBlockReason}
            pilotUserId={effectivePicId}
            overridesAcknowledged={overridesAcknowledged}
            notamAckedIcaos={notamAckedIcaos}
            staleWeatherAcknowledged={staleWeatherAcknowledged}
            acknowledgedWarnings={Array.from(ackedWarnCodes)}
            risk={risk}
            canEditRisk={canEditRisk}
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
  seat: CrewSeat = "pic",
  flightId: string | null = null,
): Promise<PicComplianceResponse | null> {
  try {
    return await getPicCompliance(pilotId, seat, flightId);
  } catch {
    return null;
  }
}

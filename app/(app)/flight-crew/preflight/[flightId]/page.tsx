import Link from "next/link";
import { notFound } from "next/navigation";

import { linkCaps } from "@/components/ff/controls";
import { ApiError } from "@/lib/api/client";
import {
  getCurrentDuty,
  getFlight,
  getLatestFratAssessment,
  getLatestPilotAcceptance,
  getWeightReturn,
  getPreflightProgress,
  listFlightLogs,
} from "@/lib/api/ops";
import { getFratThresholds, loadZoneTable } from "@/lib/api/auth";
import { loadFratInputs } from "@/lib/frat/load-inputs";
import { getFlightLoad, type FlightLoad } from "@/lib/api/manifest";
import { listFuelOrders, listSupplierBases } from "@/lib/api/ground";
import { zoneFor } from "@/lib/format/local-time";
import { fuelTypeForAircraft, supplierOptionsFor } from "@/lib/fuel";
import { cn } from "@/lib/utils";
import type {
  FratBlockEligibilityResponse,
  FratPrefillResponse,
  FratThresholdConfigResponse,
  CurrentDutyResponse,
  FlightDetail,
  FlightLogResponse,
  FratAssessmentResponse,
  PilotAcceptanceResponse,
  WeightReturn,
  PreflightProgressResponse,
  WeatherBatchResponse,
} from "@/lib/api/types";

import { PreflightFuel } from "./preflight-fuel";
import { PreflightShell } from "./preflight-shell";

const DUTY_OFFLINE_DEFAULT: CurrentDutyResponse = {
  open: null,
  last_closed: null,
  min_rest_hours: 9,
  max_duty_hours: 14,
  warnings: [],
};

/**
 * /flight-crew/preflight/[flightId] — 8-step gated preflight job flow
 * (Spec 4 §"8-STEP PREFLIGHT JOB FLOW").
 *
 * Layout per Spec 4 §"Step header — always visible":
 *   1. Flight context bar (flight #, route, aircraft tail, ETD) — sticky
 *   2. Progress indicator (step X of 8) with green checkmarks for done
 *   3. The active step's content area
 *
 * Server-side gating: the backend's POST /preflight/{id}/steps/{n}
 * rejects with 409 if step n-1 isn't complete, so an attacker can't
 * skip ahead even with a hand-crafted request. The frontend only
 * renders the next-required step's UI; previous steps render as
 * collapsed "Completed at HH:MMZ" rows.
 *
 * All 8 steps shipped (M2-G-7):
 *   - Step 1: Review Dispatch Release (scroll-to-bottom + ack checkbox)
 *   - Step 2: Weight and Balance Review (ack checkbox, no W&B math yet)
 *   - Step 3: Weather + NOTAM Review (one ack per routing airport)
 *   - Step 4: FRAT (LOW/MED/HIGH/EXTREME with dispatch / CP+DO
 *             authorization gates)
 *   - Step 5: Duty In confirmation (reads /duty/current)
 *   - Step 6: Accept or Deny Release (writes flight_pilot_acceptance)
 *   - Step 7: Flight Following Position Reports (ack + dispatch links)
 *   - Step 8: Post-Flight Log (opens the draft arrival filled in, else /flight-crew/elog)
 */
export default async function PreflightPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight: FlightDetail | null = null;
  let progress: PreflightProgressResponse | null = null;
  let duty: CurrentDutyResponse = DUTY_OFFLINE_DEFAULT;
  let frat: FratAssessmentResponse | null = null;
  let acceptance: PilotAcceptanceResponse | null = null;
  let weightReturn: WeightReturn | null = null;
  let flightLoad: FlightLoad | null = null;
  let weather: WeatherBatchResponse | null = null;
  let fratConfig: FratThresholdConfigResponse | null = null;
  let fratPrefill: FratPrefillResponse | null = null;
  let fratBlock: FratBlockEligibilityResponse | null = null;
  let flightLog: FlightLogResponse | null = null;
  let loadError: string | null = null;

  try {
    // Fan-out: flight + progress are required; duty + latest FRAT +
    // latest pilot acceptance are best-effort (404 / missing data is
    // normal and the step UIs handle the empty case gracefully).
    const [
      flightResult,
      progressResult,
      dutyResult,
      fratResult,
      acceptanceResult,
      weightReturnResult,
      fratConfigResult,
      flightLoadResult,
      flightLogResult,
    ] = await Promise.all([
        getFlight(flightId),
        getPreflightProgress(flightId),
        getCurrentDuty().catch(() => DUTY_OFFLINE_DEFAULT),
        getLatestFratAssessment(flightId).catch((err) => {
          // 404 'no_assessment' is the normal pre-FRAT state.
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
        getLatestPilotAcceptance(flightId).catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
        // Step 2 — null is the normal "within limits" answer, so only a
        // real failure should surface. Best-effort like the rest: the
        // server-side step-2 gate is what actually enforces this, so a
        // failed read here cannot let an over-weight flight through.
        getWeightReturn(flightId).catch(() => null),
        // Company operating limits. Best-effort: without them the wind
        // factor says the limit is unavailable and the pilot scores it
        // by hand, which is what they did before any of this existed.
        getFratThresholds().catch(() => null),
        // Step 2's weight and balance (#111): useful load less crew,
        // fuel and the manifest's payload. Best-effort: without it the
        // step shows the aircraft's useful load, as before.
        getFlightLoad(flightId).catch(() => null),
        // Step 8: the draft log arrival opened, filled from the flight
        // (the client, 30 Oct). Best-effort: without it the step points
        // at the logbook, as before.
        listFlightLogs({ flightId, mine: true, limit: 1 }).catch(() => null),
      ]);
    flight = flightResult;
    progress = progressResult;
    duty = dutyResult;
    frat = fratResult;
    acceptance = acceptanceResult;
    weightReturn = weightReturnResult;
    flightLoad = flightLoadResult;
    flightLog = flightLogResult?.items[0] ?? null;
    fratConfig = fratConfigResult;
    // Step 3's weather and step 4's prefill and block FRAT, as the
    // flight's FRAT page loads them (#155). Non-fatal: without weather,
    // step 3 renders its "data unavailable" acknowledgment and step 4 the
    // questionnaire unfilled.
    ({ weather, fratPrefill, fratBlock } = await loadFratInputs(flightResult));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    if (err instanceof ApiError && err.status === 401) {
      loadError = "Your session expired — please sign in again.";
    } else {
      loadError = "Couldn't load preflight progress. Try refreshing.";
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <BackLink />
        <div
          role="alert"
          className="notice notice-yellow text-sm"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (!flight || !progress) notFound();

  // Fuel: the flight's orders and the departure base's suppliers for
  // this aircraft's fuel. Best-effort, like the weather: a failure costs
  // the pilot the fuel card, not the preflight.
  const fuelTypeCode = fuelTypeForAircraft(flight.aircraft.model);
  const [[fuelOrders, fuelBases], zones] = await Promise.all([
    Promise.allSettled([
      listFuelOrders({ flightId: flight.id }),
      listSupplierBases({ baseCode: flight.origin }),
    ]),
    loadZoneTable(),
  ]);
  const fuel = (
    <PreflightFuel
      flight={flight}
      fuelTypeCode={fuelTypeCode}
      timeZone={zoneFor(zones, flight.origin)}
      orders={fuelOrders.status === "fulfilled" ? fuelOrders.value.items : []}
      options={
        fuelBases.status === "fulfilled"
          ? supplierOptionsFor(fuelBases.value.items, fuelTypeCode)
          : []
      }
      unavailable={
        fuelOrders.status === "rejected" || fuelBases.status === "rejected"
          ? "Fuel unavailable — try refreshing in a moment."
          : null
      }
    />
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PreflightShell
        flight={flight}
        progress={progress}
        duty={duty}
        frat={frat}
        acceptance={acceptance}
        weightReturn={weightReturn}
        flightLoad={flightLoad}
        weather={weather}
        fratConfig={fratConfig}
        fratPrefill={fratPrefill}
        fratBlock={fratBlock}
        fuel={fuel}
        flightLog={flightLog}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/flight-crew" className={cn(linkCaps, "mb-4 text-muted-foreground hover:text-foreground")}>
      <span aria-hidden>‹</span> Flight Crew
    </Link>
  );
}

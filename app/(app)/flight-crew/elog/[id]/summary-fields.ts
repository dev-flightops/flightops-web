import type { FlightLogLeg } from "@/lib/api/types";

/**
 * Spec 4 Tab 4 — Flight Summary roll-ups.
 *
 * Pure derivation from per-leg fields. Kept server- and client-safe
 * so the tab can render server-side and the Submit-button preview
 * (M2-M-9 chain, follow-up PR) can call the same function.
 *
 * Per-leg semantics:
 *   blockHours  = blocks_on − blocks_off
 *   flightHours = engine_off − engine_on
 *   hobbsHours  = end_hobbs − start_hobbs
 *
 * Time fields are "HH:MM:SS" local clock strings; pair with the
 * parent log's `flight_date` to reconstruct full datetimes. When a
 * leg `crosses_midnight`, blocks_on / engine_off are treated as
 * +24h so the duration is positive.
 *
 * Legs missing either endpoint of a duration contribute `null` to
 * that sum — distinct from "0 hours". The tiles render "—" for
 * null totals so an unfinished draft doesn't read as "0.0".
 *
 * Landings and night_landings always default to 0 at the leg level
 * (non-nullable), so their totals are always concrete integers.
 */
export interface FlightLogSummary {
  legCount: number;
  totalFlightHours: number | null;
  totalBlockHours: number | null;
  totalHobbsHours: number | null;
  totalLandings: number;
  totalNightLandings: number;
  totalFuelGallons: number | null;
}

export function computeFlightLogSummary(
  legs: ReadonlyArray<FlightLogLeg>,
): FlightLogSummary {
  let flight = 0;
  let flightHasAny = false;
  let block = 0;
  let blockHasAny = false;
  let hobbs = 0;
  let hobbsHasAny = false;
  let landings = 0;
  let nightLandings = 0;
  let fuel = 0;
  let fuelHasAny = false;

  for (const leg of legs) {
    const f = legHours(leg.engine_on, leg.engine_off, leg.crosses_midnight);
    if (f !== null) {
      flight += f;
      flightHasAny = true;
    }

    const b = legHours(leg.blocks_off, leg.blocks_on, leg.crosses_midnight);
    if (b !== null) {
      block += b;
      blockHasAny = true;
    }

    if (leg.start_hobbs !== null && leg.end_hobbs !== null) {
      hobbs += leg.end_hobbs - leg.start_hobbs;
      hobbsHasAny = true;
    }

    landings += leg.landings;
    nightLandings += leg.night_landings;

    if (leg.fuel_gallons !== null) {
      fuel += leg.fuel_gallons;
      fuelHasAny = true;
    }
  }

  return {
    legCount: legs.length,
    totalFlightHours: flightHasAny ? round1(flight) : null,
    totalBlockHours: blockHasAny ? round1(block) : null,
    totalHobbsHours: hobbsHasAny ? round1(hobbs) : null,
    totalLandings: landings,
    totalNightLandings: nightLandings,
    totalFuelGallons: fuelHasAny ? round1(fuel) : null,
  };
}

function legHours(
  startClock: string | null,
  endClock: string | null,
  crossesMidnight: boolean,
): number | null {
  if (startClock === null || endClock === null) return null;
  const startMin = clockToMinutes(startClock);
  const endMinRaw = clockToMinutes(endClock);
  if (startMin === null || endMinRaw === null) return null;
  const endMin = crossesMidnight ? endMinRaw + 1440 : endMinRaw;
  const diff = endMin - startMin;
  if (diff < 0) return null;
  return diff / 60;
}

function clockToMinutes(clock: string): number | null {
  // Accept "HH:MM" or "HH:MM:SS"; seconds are ignored for the
  // minute-granularity computation. Anything else → null.
  const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(clock);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

import { getFlightAssignment, listFuelOrders } from "@/lib/api/ground";
import { getFlightLoad, type FlightLoad } from "@/lib/api/manifest";
import type {
  FlightAssignmentResponse,
  FlightListItem,
  FuelOrderResponse,
  WeatherReportResponse,
} from "@/lib/api/types";
import { batchWeather } from "@/lib/api/weather";
import { flightStops } from "@/lib/route";

/**
 * The pilot's next flights, read from the air (20 Nov). The client: "the
 * ability to see routing/current weather (winds/ceiling/vis), so that I
 * can order fuel while I'm still in the air." Best-effort throughout: a
 * failure costs a row its weather or its status, not the schedule.
 */

/** A flight's fuel, load and passengers, as the preflight reads them. */
export interface FlightReady {
  fuelOrders: FuelOrderResponse[] | null;
  /** null: no load team; undefined: it couldn't be read. */
  assignment: FlightAssignmentResponse | null | undefined;
  flightLoad: FlightLoad | null;
}

/** The weather service takes this many reports a request. */
const PER_BATCH = 20;

/** The current METAR at every stop of these flights, by ICAO: every stop,
 *  in as many batches as it takes, so a long schedule doesn't lose its
 *  later airports (Codex, web #501). A failed batch loses only its own. */
export async function stopsWeather(flights: FlightListItem[]): Promise<Record<string, WeatherReportResponse>> {
  const icaos = [...new Set(flights.flatMap((f) => flightStops(f).map((s) => s.toUpperCase())))];
  const batches: string[][] = [];
  for (let i = 0; i < icaos.length; i += PER_BATCH) batches.push(icaos.slice(i, i + PER_BATCH));
  const answers = await Promise.all(
    batches.map((batch) => batchWeather(batch.map((icao) => ({ icao, kind: "metar" as const }))).catch(() => null)),
  );
  const byIcao: Record<string, WeatherReportResponse> = {};
  for (const answer of answers) {
    for (const r of answer?.items ?? []) if (r.kind === "metar") byIcao[r.icao.toUpperCase()] = r;
  }
  return byIcao;
}

/** Each flight's fuel orders, load team and passengers, by flight id. */
export async function flightReadiness(flights: FlightListItem[]): Promise<Record<string, FlightReady>> {
  const rows = await Promise.all(
    flights.map(async (f) => {
      const [orders, assignment, load] = await Promise.allSettled([
        listFuelOrders({ flightId: f.id }),
        getFlightAssignment(f.id),
        getFlightLoad(f.id),
      ]);
      const row: FlightReady = {
        fuelOrders: orders.status === "fulfilled" ? orders.value.items : null,
        assignment: assignment.status === "fulfilled" ? assignment.value : undefined,
        flightLoad: load.status === "fulfilled" ? load.value : null,
      };
      return [f.id, row] as const;
    }),
  );
  return Object.fromEntries(rows);
}

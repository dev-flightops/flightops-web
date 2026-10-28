import type { AircraftListItem } from "@/lib/api/types";

/** A setting an aircraft lacks, and what that stops (#138). */
export interface AircraftGap {
  what: string;
  stops: string;
}

/**
 * What an aircraft is missing that a flight on it needs (#138), each with
 * what it stops, as Settings → Fleet and the Setup check list them.
 *
 * The client’s demo, 28 Oct: of five active aircraft, N200PA and N604PA had
 * no cruise speed, so Open Flight couldn't fill in their times. The useful
 * load is the max payload, entered as it is or kept equal to max gross
 * less empty weight when both are (ops' aircraft route); the manifest and
 * the pilot's weight and balance read it.
 */
export function aircraftGaps(aircraft: AircraftListItem): AircraftGap[] {
  const gaps: AircraftGap[] = [];
  if (aircraft.cruise_speed_kt == null) {
    gaps.push({ what: "cruise speed", stops: "Open Flight can’t fill in the leg times" });
  }
  if (aircraft.max_payload_lbs == null) {
    gaps.push({
      what: "useful load (max gross and empty weight)",
      stops: "the manifest and the pilot’s weight and balance can’t work out the weight left",
    });
  }
  if (!aircraft.airframe_type) {
    gaps.push({ what: "airframe type", stops: "the fuel can’t be estimated or the flight costed" });
  }
  return gaps;
}

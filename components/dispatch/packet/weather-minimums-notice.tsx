import type { WeatherMinimumsView } from "@/lib/api/types";
import {
  belowSummary,
  heldForType,
  heldForVfr,
  minimumsLabel,
  withoutApproach,
} from "@/lib/frat/weather-minimums";

/**
 * The company's dispatch minimums on this flight (#89, #110, #123).
 *
 * For an aircraft the company lists as not IFR certified (Settings →
 * Flight Risk) or a flight flown VFR, at every stop; and on an IFR flight
 * at a village airport without an instrument approach (Weather → Village
 * Wx), which is reached VFR. Below them the release is refused, and
 * nothing on this page clears that: the weather has to come up (refresh
 * it above), the flight is marked IFR, or it goes another way. Above
 * them, one quiet line says the check was made, so a dispatcher knows the
 * rule applied rather than guessing it didn't.
 */
export function WeatherMinimumsNotice({
  minimums,
}: {
  minimums: WeatherMinimumsView | null | undefined;
}) {
  if (!minimums?.applies) return null;
  const label = minimumsLabel(minimums.min_ceiling_ft, minimums.min_visibility_sm);
  const type = (minimums.airframe_type ?? "this aircraft").toUpperCase();
  const unchecked = minimums.stations
    .filter((s) => s.observations.length === 0)
    .map((s) => s.icao);

  const forType = heldForType(minimums.stations);
  const forVfr = !forType && heldForVfr(minimums.stations);
  if (minimums.below) {
    const fields = withoutApproach(minimums.stations.filter((s) => s.below));
    return (
      <div role="alert" className="notice notice-red">
        <p className="notice-label">Below company minimums</p>
        {/* One template literal: Next's server render can drop the space
            after an expression in text that also holds an entity. */}
        <p className="mt-1 text-xs">
          {forType
            ? `${belowSummary(minimums.stations)}. The ${type} is not IFR certified, and the company’s dispatch minimums are ${label} at every stop. It can’t be released until the weather comes up, or on an IFR-certified aircraft.`
            : forVfr
            ? `${belowSummary(minimums.stations)}. The flight is flown VFR, and the company’s dispatch minimums for a VFR flight are ${label} at every stop. It can’t be released until the weather comes up. If it will be flown IFR, tick Flown IFR under Edit.`
            : `${belowSummary(minimums.stations)}. There’s no instrument approach at ${fields}, so it’s reached VFR whatever the aircraft, and the company’s dispatch minimums there are ${label}. It can’t be released until the weather there comes up.`}
        </p>
      </div>
    );
  }

  const held = forType
    ? `The ${type} is not IFR certified: held to the company’s dispatch minimums of ${label} at every stop`
    : forVfr
      ? `Flown VFR: held to the company’s dispatch minimums of ${label} at every stop`
      : `No instrument approach at ${withoutApproach(minimums.stations)}: held to the company’s dispatch minimums of ${label} there`;
  if (unchecked.length > 0) {
    // #155: a stop with no report read "met" (the client's ZZZZ). It can't
    // be checked, which is not the same thing.
    const checked = minimums.stations.length > unchecked.length;
    return (
      <div role="note" className="notice notice-yellow">
        <p className="notice-label">No report to check</p>
        <p className="mt-1 text-xs">
          {`${held}. ${checked ? "Met where there’s a report; no" : "No"} current report at ${unchecked.join(", ")}, so the minimums can’t be checked there. Read the weather in your usual source before releasing.`}
        </p>
      </div>
    );
  }

  return (
    <p className="text-[0.6875rem] text-muted-foreground">{`${held}, and met on the latest weather.`}</p>
  );
}

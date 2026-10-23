import type { WeatherMinimumsView } from "@/lib/api/types";
import {
  belowSummary,
  heldForType,
  minimumsLabel,
  withoutApproach,
} from "@/lib/frat/weather-minimums";

/**
 * The company's dispatch minimums on this flight (#89, #110).
 *
 * For an aircraft the company lists as not IFR certified (Settings →
 * Flight Risk), at every stop; and for any aircraft at a village airport
 * without an instrument approach (Weather → Village Wx), which is reached
 * VFR. Below them the release is refused, and nothing on this page clears
 * that: the weather has to come up (refresh it above), or the flight goes
 * another way. Above them, one quiet line says the check was made, so a
 * dispatcher knows the rule applied rather than guessing it didn't.
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
  const noReport =
    unchecked.length > 0 ? ` (no current report at ${unchecked.join(", ")})` : "";

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
            : `${belowSummary(minimums.stations)}. There’s no instrument approach at ${fields}, so it’s reached VFR whatever the aircraft, and the company’s dispatch minimums there are ${label}. It can’t be released until the weather there comes up.`}
        </p>
      </div>
    );
  }

  return (
    <p className="text-[0.6875rem] text-muted-foreground">
      {forType
        ? `The ${type} is not IFR certified: held to the company’s dispatch minimums of ${label} at every stop, and met on the latest weather${noReport}.`
        : `No instrument approach at ${withoutApproach(minimums.stations)}: held to the company’s dispatch minimums of ${label} there, and met on the latest weather${noReport}.`}
    </p>
  );
}

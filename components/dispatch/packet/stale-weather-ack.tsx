"use client";

import type { RouteFreshness } from "@/lib/api/types";

import { useSavedAcks } from "./use-saved-acks";

/**
 * Stale / missing weather acknowledgment (HALT-2).
 *
 * The release gate blocks when the route has weather older than the
 * legacy thresholds (METAR >60 min, field report >2 hr) or none on file.
 * This is the control that clears it — without it the block has no exit
 * and a dispatcher facing stale weather cannot release at all.
 *
 * State lives in the URL (`?stale_wx_ack=1`), matching the NOTAM panel:
 * shareable with a supervisor, survives reload, and composes with the
 * rest of the Generate-PDF gate.
 *
 * Ticking this is NOT a bypass. The release endpoint re-derives
 * staleness from the same shared evaluator and records what was
 * acknowledged — including the actual observation ages — in the release
 * audit event. The dispatcher is signing off on old weather, which they
 * are licensed to do; the point is that the decision is deliberate and
 * leaves a trace.
 *
 * Renders nothing when no acknowledgment is required, so a clean route
 * shows no checkbox to click past out of habit.
 */
export function StaleWeatherAck({
  flightId,
  freshness,
  acknowledged,
}: {
  flightId: string | null;
  freshness: RouteFreshness | null;
  /** The viewer acknowledged it, as saved (#155). */
  acknowledged: boolean;
}) {
  const { isOn, change, error } = useSavedAcks(
    flightId ?? "",
    "stale_weather",
    acknowledged ? new Set(["route"]) : new Set(),
  );

  if (freshness === null || !freshness.acknowledgment_required || !flightId) return null;

  const toggle = (checked: boolean) =>
    change(["route"], checked, () => ({ stations: freshness.stations_requiring_acknowledgment }), 0);

  return (
    <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/5 p-3">
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={isOn("route")}
          onChange={(e) => toggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-status-yellow"
        />
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-status-yellow">
            Acknowledge stale or missing weather
          </span>
          <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
            {describe(freshness)}
          </span>
        </span>
      </label>
      {error ? (
        <p role="alert" className="field-error mt-1">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Say what is actually wrong and where. "Acknowledge stale weather"
 * without naming the stop sends the dispatcher hunting through every
 * airport on the route to find which one it means.
 */
function describe(freshness: RouteFreshness): string {
  const parts: string[] = [];
  for (const station of freshness.stations) {
    if (!station.requires_acknowledgment) continue;
    if (!station.has_any_weather) {
      // A WeatherCam reading may be on the card (#117), but the release's
      // gate counts only these two.
      parts.push(`${station.icao}: no METAR or village report`);
    } else if (station.metar_stale) {
      parts.push(
        station.metar_age_minutes != null
          ? `${station.icao}: METAR ${formatAge(station.metar_age_minutes)} old`
          : `${station.icao}: METAR observation time unreadable`,
      );
    } else if (station.field_report_stale) {
      parts.push(
        station.field_report_age_minutes != null
          ? `${station.icao}: field report ${formatAge(station.field_report_age_minutes)} old`
          : `${station.icao}: field report time unreadable`,
      );
    }
  }
  return parts.length > 0
    ? `${parts.join(" · ")}. Review before releasing.`
    : "Review the Weather panel before releasing.";
}

/** Minutes read badly past an hour or so — "142 min" makes a dispatcher
 *  do arithmetic to judge how stale it really is. */
function formatAge(minutes: number): string {
  if (minutes < 90) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

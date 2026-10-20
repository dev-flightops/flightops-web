import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { listAircraft, listFlights } from "@/lib/api/ops";
import type { AircraftListItem, FlightListItem } from "@/lib/api/types";

import { NewBriefingForm } from "./new-briefing-form";

/**
 * /weather/new — create a saved Weather Briefing (M2-G-27).
 *
 * Layout matches legacy `templates/weather_briefing/new.html`:
 *   - max-w-2xl, py-10 — narrow, single-column form
 *   - "← Briefing History" back link
 *   - panel wraps the form
 *   - Flight + Aircraft in a grid-cols-2 row
 *   - "Fetch Weather & Create Briefing" full-width primary button
 *   - footer helper text below the panel (verbatim from legacy):
 *     "Fetches live METAR, TAF, PIREPs, and area forecast. Briefing
 *     is saved and can be viewed later."  (PIREP + area-forecast
 *     wording kept for product parity; backend fetches METAR + TAF
 *     today and the rest lands in M3.)
 */
export default async function NewBriefingPage() {
  let aircraft: AircraftListItem[] = [];
  let flights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    const [aircraftResult, flightsResult] = await Promise.all([
      listAircraft(),
      listFlights({ status: "released", limit: 50 }),
    ]);
    aircraft = aircraftResult.items.filter((a) => a.is_active);
    flights = flightsResult.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load aircraft or flights. The briefing form still works — pickers will show fewer options.";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <PageHeader back={{ href: "/weather", label: "Briefing History" }} title="New Weather Briefing" />

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <NewBriefingForm aircraft={aircraft} flights={flights} />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Fetches live METAR, TAF, PIREPs, and area forecast. Briefing is
        saved and can be viewed later.
      </p>
    </div>
  );
}

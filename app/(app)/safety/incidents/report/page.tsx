import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";

import { IncidentReportForm } from "./report-form";

/**
 * /safety/incidents/report — File a new incident.
 *
 * Same broad-allow pattern as hazards. Stations dropdown is
 * pre-loaded server-side; aircraft/flight typeaheads are deferred
 * to a follow-up story (both need lightweight search endpoints
 * that the current lib/api doesn't wrap).
 */
export default async function IncidentReportPage() {
  let stations: StationListItem[] = [];
  try {
    stations = (await listStations({ limit: 200 })).items;
  } catch (err) {
    if (err instanceof ApiError && err.status !== 401) {
      stations = [];
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/safety/incidents" className="hover:text-foreground">
            ← Incidents
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          File an Incident
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Report an event that has already occurred. Injury + damage
          answers are required so the Safety Officer sees the impact at
          a glance — write &ldquo;none&rdquo; if there weren&rsquo;t any.
        </p>
      </header>

      <IncidentReportForm stations={stations} />
    </div>
  );
}

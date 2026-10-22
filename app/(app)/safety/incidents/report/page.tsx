import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { loadZoneTable } from "@/lib/api/auth";
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
  // The time is typed local to the station, or the company's base (#72).
  const zones = loadZoneTable();
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
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/safety/incidents" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Incidents
        </Link>
        <h1 className="mt-2 page-title">
          File an Incident
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Report an event that has already occurred. Injury + damage
          answers are required so the Safety Officer sees the impact at
          a glance — write &ldquo;none&rdquo; if there weren&rsquo;t any.
        </p>
      </header>

      <IncidentReportForm
        stations={stations}
        zones={await zones}
        now={new Date().toISOString()}
      />
    </div>
  );
}

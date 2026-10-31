import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";
import { hasAnyRole, STATION_ADMINS } from "@/lib/roles";

/**
 * /stations — Stations list page (M2-G-38 rebuild).
 *
 * Mirrors legacy `templates/stations/list.html`:
 *   - Title + subtitle + (M2-G-38b) "Add Station" CTA top-right
 *   - Table: ICAO · Name · Longest Runway · Source · Reporting · Issues · View
 *   - Runway-length badges: <2500ft → red "SHORT", <4000ft → yellow
 *     "CAUTION", else plain. Matches legacy thresholds verbatim.
 *   - Empty state matches legacy: "No stations yet."
 *
 * Create + edit + runway override land in M2-G-38b. This story keeps
 * the page read-only so dispatchers can browse what seeded data ships
 * with the demo tenant.
 */

const STATIONS_LIMIT = 200;

export default async function StationsPage() {
  // Adding a station is station staff's and management's (STATION_ADMINS,
  // enforced by the backend since 29 Sep).
  const canAdd = hasAnyRole((await auth())?.roles ?? [], STATION_ADMINS);
  let stations: StationListItem[] = [];
  let loadError: string | null = null;

  try {
    stations = (await listStations({ limit: STATIONS_LIMIT })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Stations feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Stations</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            ICAO master list — runway data, reporting flag, and the
            station-issue tracker.
          </p>
        </div>
        {canAdd ? (
          <Link
            href="/stations/new"
            className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1.5 text-primary hover:bg-primary/5 text-[0.72rem]"
          >
            + Add Station
          </Link>
        ) : null}
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : stations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">No stations yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canAdd
              ? <>Use &ldquo;+ Add Station&rdquo; above to create the first one.</>
              : "Ground Ops, the Director of Operations or an Exec Admin adds stations."}
          </p>
        </div>
      ) : (
        <StationsTable stations={stations} />
      )}
    </div>
  );
}

function StationsTable({ stations }: { stations: StationListItem[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left eyebrow">
            <th className="px-4 py-3">ICAO</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Longest Runway</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-center">Reporting</th>
            <th className="px-4 py-3 text-center">Issues</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-mono font-semibold text-foreground">
                {s.icao_code}
              </td>
              <td className="px-4 py-3">
                <span className="text-foreground">{s.name}</span>
                {s.city && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    · {s.city}
                  </span>
                )}
              </td>
              <td className="px-4 py-3">
                <RunwayCell station={s} />
              </td>
              <td className="px-4 py-3">
                <SourceCell station={s} />
              </td>
              <td className="px-4 py-3 text-center">
                {s.has_reporting_function ? (
                  <span className="status-mark text-status-green">
                    YES
                  </span>
                ) : (
                  <span className="status-mark text-status-red">
                    NO
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center">
                <IssueChip count={s.open_issue_count} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/stations/${s.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunwayCell({ station }: { station: StationListItem }) {
  const len = station.runway_length_ft;
  const width = station.runway_width_ft;
  // #157: "Levelock '01/193,284 × 60 ft'": the name and the length ran
  // together, a margin being no separator to anyone reading or copying it.
  // And "not cached" was the lookup's word, not the operator's.
  if (len === null || width === null) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title="The risk matrix uses FAA data where it has the airport; enter the runway on the station for a village strip it doesn't."
      >
        Not entered
      </span>
    );
  }
  return (
    <span className="font-mono text-xs text-foreground">
      {station.runway_primary_name ? `${station.runway_primary_name} · ` : null}
      {len.toLocaleString()} × {width} ft
      {len < 2500 && (
        <span className="status-mark ml-2 text-status-red">
          SHORT
        </span>
      )}
      {len >= 2500 && len < 4000 && (
        <span className="status-mark ml-2 text-status-yellow">
          CAUTION
        </span>
      )}
    </span>
  );
}

function SourceCell({ station }: { station: StationListItem }) {
  if (!station.runway_source) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (station.runway_source === "faa_api") {
    return (
      <span className="eyebrow">
        FAA API
      </span>
    );
  }
  if (station.runway_source === "manual") {
    return (
      <span className="status-mark text-status-green">
        Manual
      </span>
    );
  }
  return (
    <span className="eyebrow">
      Seeded
    </span>
  );
}

function IssueChip({ count }: { count: number }) {
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="status-mark text-status-yellow">
      {count} open
    </span>
  );
}

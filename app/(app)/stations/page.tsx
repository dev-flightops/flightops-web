import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";

/**
 * /stations — Ground Ops landing (matches legacy
 * `templates/stations/list.html`).
 *
 * The legacy treats `/stations/` as the Ground Ops landing — title is
 * "Ground Ops" with subtitle "Stations, issue tracker, crew & GSE",
 * with the action bar (Issue Tracker · + Report Issue · + Add Station)
 * top-right and the master ICAO table below.
 *
 * Create / refresh / override / edit forms land in M2-G-38b — the
 * buttons are rendered as dimmed placeholders until then so the layout
 * matches legacy even though the actions aren't wired.
 */

const STATIONS_LIMIT = 200;

export default async function StationsPage() {
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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Ground Ops</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stations, issue tracker, crew &amp; GSE
          </p>
        </div>
        <HeaderActions />
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : stations.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          No stations yet. Add your first station above.
        </div>
      ) : (
        <StationsTable stations={stations} />
      )}
    </div>
  );
}

function HeaderActions() {
  // All three actions are wired to M2-G-38b. Rendering them as dimmed
  // matching the legacy layout means the page chrome is faithful even
  // though the forms aren't connected yet.
  return (
    <div className="flex flex-wrap gap-2">
      <DisabledButton
        title="Coming in M2"
        className="border-status-orange/40 text-status-orange/70"
      >
        🗂 Issue Tracker
      </DisabledButton>
      <DisabledButton title="Coming in M2">
        + Report Issue
      </DisabledButton>
      <DisabledButton
        title="Coming in M2"
        className="border-status-blue bg-status-blue/15 text-status-blue"
      >
        + Add Station
      </DisabledButton>
    </div>
  );
}

function DisabledButton({
  children,
  title,
  className = "",
}: {
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className={`cursor-not-allowed rounded-md border border-border bg-card/40 px-3 py-1.5 text-xs font-semibold text-foreground/70 opacity-70 ${className}`}
    >
      {children}
    </button>
  );
}

function StationsTable({ stations }: { stations: StationListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-background/50 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-4 py-3">ICAO</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Longest Runway</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3 text-center">Reporting</th>
            <th className="px-4 py-3 text-center">Grant Stn</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <StationRow key={s.id} station={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StationRow({ station }: { station: StationListItem }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3 font-mono font-bold text-foreground">
        {station.icao_code}
      </td>
      <td className="px-4 py-3">
        <span className="text-foreground">{station.name}</span>
        {station.city && (
          <span className="ml-1 text-xs text-muted-foreground">
            · {station.city}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <RunwayCell station={station} />
      </td>
      <td className="px-4 py-3">
        <SourceCell station={station} />
      </td>
      <td className="px-4 py-3 text-center">
        {station.has_reporting_function ? (
          <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-green">
            YES
          </span>
        ) : (
          <span className="rounded-md border border-status-red/40 bg-status-red/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-red">
            NO
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">
        {/*
          Legacy carries an `is_grant_station` boolean on the Station model
          (Alaska bypass-mail flag). We dropped the field during M2-M-25a
          extraction; backfilling it is a follow-up — for now the cell
          renders as a placeholder so the layout matches legacy.
        */}
        —
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap justify-end gap-1.5">
          <RowAction title="Pull runway data from aviationweather.gov (Coming in M2)">
            ↻ FAA
          </RowAction>
          <RowAction title="Manual runway override (Coming in M2)">
            ✎ Override
          </RowAction>
          <RowAction title="Edit station (Coming in M2)">Edit</RowAction>
          <Link
            href={`/stations/${station.id}`}
            className="rounded-md border border-border bg-card/40 px-2 py-1 text-[0.7rem] font-semibold text-status-blue hover:bg-status-blue/5"
          >
            View →
          </Link>
        </div>
      </td>
    </tr>
  );
}

function RowAction({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={title}
      className="cursor-not-allowed rounded-md border border-border bg-card/40 px-2 py-1 text-[0.7rem] font-semibold text-foreground/60 opacity-60"
    >
      {children}
    </button>
  );
}

function RunwayCell({ station }: { station: StationListItem }) {
  const len = station.runway_length_ft;
  const width = station.runway_width_ft;
  if (len === null || width === null) {
    return <span className="text-xs text-status-yellow">not cached</span>;
  }
  return (
    <span className="font-mono text-xs text-foreground">
      {station.runway_primary_name && (
        <span className="mr-3">{station.runway_primary_name}</span>
      )}
      {len.toLocaleString()} × {width} ft
      {len < 2500 && (
        <span className="ml-2 rounded-md border border-status-red/40 bg-status-red/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-status-red">
          SHORT
        </span>
      )}
      {len >= 2500 && len < 4000 && (
        <span className="ml-2 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.6rem] font-semibold text-status-yellow">
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
      <span className="rounded-md border border-status-blue/40 bg-status-blue/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-blue">
        FAA API
      </span>
    );
  }
  if (station.runway_source === "manual") {
    return (
      <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-green">
        Manual
      </span>
    );
  }
  return (
    <span className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
      Seeded
    </span>
  );
}

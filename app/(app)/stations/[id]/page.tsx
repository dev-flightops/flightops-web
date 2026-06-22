import Link from "next/link";
import { notFound } from "next/navigation";

import { ReportIssueDialog } from "@/components/stations/report-issue-dialog";
import { ResolveIssueButton } from "@/components/stations/resolve-issue-button";
import { ApiError } from "@/lib/api/client";
import { listStationIssues, listStations } from "@/lib/api/ground";
import type {
  StationIssueResponse,
  StationListItem,
  StationType,
} from "@/lib/api/types";

import { StationActiveToggle } from "./active-toggle";

const STATION_TYPE_LABELS: Record<StationType, string> = {
  hub_base: "Hub Base",
  spoke_base: "Spoke Base",
  village_airport: "Village Airport",
  maintenance_base: "Maintenance Base",
  custom: "Custom",
};

/**
 * /stations/{id} — Station detail + station-issue feed (M2-G-38).
 *
 * Read-only landing for a single ICAO record:
 *   - Header: ICAO + name + (city, state) + back link
 *   - Meta block: elevation, lat/lng, runway cache + source, reporting
 *     flag
 *   - Issues section: open + recently-resolved issues, newest first.
 *     Submit + resolve forms land in M2-G-38b.
 *
 * We resolve `station_id → station` via /stations (capped + filtered by
 * the new icao_prefix arg) rather than a dedicated lookup endpoint —
 * GET /stations/{id} exists on the backend but the list endpoint is
 * already cached in transit by the hub and is cheaper to reuse here
 * than to thread a new helper through the API client. Fall back to
 * notFound() when the row is missing in the slice.
 */
export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let station: StationListItem | null = null;
  let issues: StationIssueResponse[] = [];
  let loadError: string | null = null;

  try {
    const [stationsResult, issuesResult] = await Promise.all([
      // includeInactive: the detail page must resolve a station whose
      // is_active was just flipped off — otherwise the toggle-off action
      // would surface as a 404 redirect.
      listStations({ limit: 500, includeInactive: true }),
      listStationIssues(id, { limit: 50 }),
    ]);
    station = stationsResult.items.find((s) => s.id === id) ?? null;
    issues = issuesResult.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Station unavailable. Try refreshing in a moment.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <BackLink />
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (station === null) notFound();

  const openIssues = issues.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const resolvedIssues = issues.filter(
    (i) => i.status === "resolved" || i.status === "closed",
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <BackLink />
      <Header station={station} />
      <Meta station={station} />
      <IssuesSection
        stationId={station.id}
        title={`Open issues (${openIssues.length})`}
        issues={openIssues}
        emptyHint="No open issues at this station."
        showResolve
      />
      {resolvedIssues.length > 0 && (
        <IssuesSection
          stationId={station.id}
          title={`Recently resolved (${resolvedIssues.length})`}
          issues={resolvedIssues}
          emptyHint=""
        />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/stations"
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      ← All Stations
    </Link>
  );
}

function Header({ station }: { station: StationListItem }) {
  const location = [station.city, station.state].filter(Boolean).join(", ");
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="font-mono">{station.icao_code}</span>
            <span className="ml-3 font-normal text-muted-foreground">
              {station.name}
            </span>
          </h1>
          {/* Spec 6 §"Add Station form / Station type" badge */}
          <span className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            {STATION_TYPE_LABELS[station.station_type]}
          </span>
          {station.is_hub && (
            <span
              title="Hub bases sort first in all dropdowns + render as larger markers on the flight following map."
              className="rounded-md border border-status-blue/40 bg-status-blue/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-blue"
            >
              Hub
            </span>
          )}
          {!station.is_active && (
            <span className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-yellow">
              Deactivated
            </span>
          )}
        </div>
        {location && (
          <p className="mt-1 text-sm text-muted-foreground">{location}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {station.has_reporting_function ? (
          <span className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-1 text-xs font-semibold text-status-green">
            Weather board
          </span>
        ) : null}
        <StationActiveToggle
          stationId={station.id}
          initial={station.is_active}
          icaoCode={station.icao_code}
        />
        <ReportIssueDialog
          stationId={station.id}
          stationLabel={`${station.icao_code} · ${station.name}`}
        />
      </div>
    </div>
  );
}

function Meta({ station }: { station: StationListItem }) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field label="Elevation" value={fmt(station.elevation_ft, " ft")} />
        <Field label="Latitude" value={fmtCoord(station.latitude)} />
        <Field label="Longitude" value={fmtCoord(station.longitude)} />
        <Field label="Open issues" value={String(station.open_issue_count)} />
        <Field
          label="Runway"
          value={
            station.runway_length_ft && station.runway_width_ft
              ? `${station.runway_primary_name ?? "RW"} · ${station.runway_length_ft} × ${station.runway_width_ft} ft`
              : "Not cached"
          }
        />
        <Field
          label="Runway source"
          value={station.runway_source ?? "—"}
        />
        <Field
          label="Fuel available"
          value={station.fuel_available ? "Yes" : "No"}
        />
        <Field
          label="Fuel types"
          value={
            station.fuel_available && station.fuel_types_available.length > 0
              ? station.fuel_types_available.join(", ")
              : "—"
          }
        />
      </dl>
      {station.notes && (
        <p className="mt-3 whitespace-pre-wrap border-t border-border pt-3 text-sm text-foreground">
          {station.notes}
        </p>
      )}
    </div>
  );
}

function IssuesSection({
  stationId,
  title,
  issues,
  emptyHint,
  showResolve = false,
}: {
  stationId: string;
  title: string;
  issues: StationIssueResponse[];
  emptyHint: string;
  showResolve?: boolean;
}) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{title}</h2>
      {issues.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              stationId={stationId}
              issue={issue}
              showResolve={showResolve}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function IssueRow({
  stationId,
  issue,
  showResolve,
}: {
  stationId: string;
  issue: StationIssueResponse;
  showResolve: boolean;
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{issue.title}</h3>
        <div className="flex items-center gap-2">
          <PriorityChip priority={issue.priority} />
          <StatusChip status={issue.status} />
          {showResolve && (
            <ResolveIssueButton
              stationId={stationId}
              issueId={issue.id}
              issueTitle={issue.title}
            />
          )}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
        {issue.description}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.65rem] text-muted-foreground">
        <span>
          <span className="font-semibold uppercase tracking-[0.05em]">
            Submitted
          </span>{" "}
          {issue.submitted_date}
          {issue.submitted_by && ` by ${issue.submitted_by.full_name}`}
        </span>
        <span>
          <span className="font-semibold uppercase tracking-[0.05em]">
            Category
          </span>{" "}
          {issue.category}
        </span>
        {issue.assigned_to && (
          <span>
            <span className="font-semibold uppercase tracking-[0.05em]">
              Assigned
            </span>{" "}
            {issue.assigned_to}
          </span>
        )}
        {issue.resolved_date && (
          <span>
            <span className="font-semibold uppercase tracking-[0.05em]">
              Resolved
            </span>{" "}
            {issue.resolved_date}
          </span>
        )}
      </div>
      {issue.resolution_notes && (
        <p className="mt-2 rounded-md border border-status-green/30 bg-status-green/5 p-2 text-xs text-foreground">
          {issue.resolution_notes}
        </p>
      )}
    </li>
  );
}

function PriorityChip({
  priority,
}: {
  priority: StationIssueResponse["priority"];
}) {
  const map: Record<typeof priority, string> = {
    low: "border-border bg-card/60 text-muted-foreground",
    normal: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    high: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    critical: "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${map[priority]}`}
    >
      {priority}
    </span>
  );
}

function StatusChip({
  status,
}: {
  status: StationIssueResponse["status"];
}) {
  const map: Record<typeof status, string> = {
    open: "border-status-red/40 bg-status-red/10 text-status-red",
    in_progress: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    resolved: "border-status-green/40 bg-status-green/10 text-status-green",
    closed: "border-border bg-card/60 text-muted-foreground",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.6rem] font-semibold uppercase ${map[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className="m-0 mt-0.5 font-mono text-sm text-foreground">{value}</dd>
    </div>
  );
}

function fmt(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${value.toLocaleString()}${suffix}`;
}

function fmtCoord(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(4);
}

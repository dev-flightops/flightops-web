import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { segment, segmentGroup } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { hasAnyRole, roleGate } from "@/lib/roles";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type Incident,
  listIncidents,
} from "@/lib/api/safety";
import { localDateTime, type ZoneTable, zoneFor } from "@/lib/format/local-time";

const TRIAGE_ROLES = roleGate(
  "safety_officer",
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

const STATUS_FILTERS: Array<{ key: string; label: string; status?: string }> = [
  { key: "open", label: "Open" },
  { key: "submitted", label: "Submitted", status: "submitted" },
  { key: "triaged", label: "Triaged", status: "triaged" },
  { key: "in_progress", label: "In Progress", status: "in_progress" },
  { key: "closed", label: "Closed", status: "closed" },
  { key: "all", label: "All" },
];

/**
 * /safety/incidents — Incident triage inbox.
 *
 * Mirrors /safety (hazards) — same filter chips, same severity sort,
 * same role gate. The only substantive difference is the row layout
 * shows occurred_at + aircraft/flight refs when present.
 */
export default async function IncidentsInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const canTriage = hasAnyRole([...roles], TRIAGE_ROLES);
  if (!canTriage) {
    redirect("/safety/incidents/mine");
  }

  const params = await searchParams;
  const filterKey = params.status ?? "open";
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];

  // Times show local to the incident's station, or the company's base
  // (#72), as they were typed.
  const zones = loadZoneTable();
  let incidents: Incident[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    if (activeFilter.key === "open") {
      const response = await listIncidents({ limit: 200 });
      incidents = response.items.filter((i) => i.status !== "closed");
      total = incidents.length;
    } else if (activeFilter.key === "all") {
      const response = await listIncidents({ limit: 200 });
      incidents = response.items;
      total = response.total;
    } else {
      const response = await listIncidents({
        status: activeFilter.status as Incident["status"],
        limit: 200,
      });
      incidents = response.items;
      total = response.total;
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Incident inbox unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link href="/safety" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Safety SMS
        </Link>
          <h1 className="mt-2 page-title">Incidents</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Events that have occurred — bird strikes, near-misses, gear events,
            spills. File one below or triage the inbox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety/actions"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Corrective Actions
          </Link>
          <Link
            href="/safety/incidents/report"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:border-foreground text-[0.72rem]"
          >
            + File an Incident
          </Link>
        </div>
      </header>

      <nav
        aria-label="Filter by status"
        className={cn(segmentGroup, "mb-4")}
      >
        {STATUS_FILTERS.map((f) => {
          const isActive = f.key === activeFilter.key;
          return (
            <Link
              key={f.key}
              href={
                f.key === "open"
                  ? "/safety/incidents"
                  : `/safety/incidents?status=${f.key}`
              }
              aria-current={isActive ? "page" : undefined}
              className={segment(isActive)}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : incidents.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No incidents matching &ldquo;{activeFilter.label}&rdquo;.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            A clean board is a good day.
          </p>
        </div>
      ) : (
        <IncidentTable incidents={incidents} total={total} zones={await zones} />
      )}
    </div>
  );
}

function IncidentTable({
  incidents,
  total,
  zones,
}: {
  incidents: Incident[];
  total: number;
  zones: ZoneTable;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="ff-thead">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Occurred
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Severity
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Aircraft
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Description
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {incidents.map((i) => (
              <tr key={i.id} className="hover:bg-accent">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {localDateTime(i.occurred_at, zoneFor(zones, i.station?.icao_code))}
                </td>
                <td className="px-4 py-3">
                  <SeverityChip severity={i.severity} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {INCIDENT_CATEGORY_LABELS[i.category]}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">
                  {i.aircraft ? i.aircraft.tail_number : "—"}
                </td>
                <td className="max-w-md px-4 py-3 text-xs">
                  <p className="line-clamp-2 text-foreground/90">
                    {i.description}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusChip status={i.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/safety/incidents/${i.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="eyebrow border-t border-border px-4 py-2">
        {total} incident{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Incident["severity"] }) {
  const cls =
    severity === "critical"
      ? "text-status-red"
      : severity === "high"
        ? "text-status-red"
        : severity === "medium"
          ? "text-status-yellow"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {HAZARD_SEVERITY_LABELS[severity]}
    </span>
  );
}

function StatusChip({ status }: { status: Incident["status"] }) {
  const cls =
    status === "submitted"
      ? "text-status-blue"
      : status === "triaged" || status === "in_progress"
        ? "text-status-yellow"
        : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {HAZARD_STATUS_LABELS[status]}
    </span>
  );
}

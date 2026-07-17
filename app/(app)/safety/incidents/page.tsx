import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type Incident,
  listIncidents,
} from "@/lib/api/safety";

const TRIAGE_ROLES = new Set(["safety_officer", "chief_pilot", "exec_admin"]);

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
  const canTriage = [...roles].some((r) => TRIAGE_ROLES.has(r));
  if (!canTriage) {
    redirect("/safety/incidents/mine");
  }

  const params = await searchParams;
  const filterKey = params.status ?? "open";
  const activeFilter =
    STATUS_FILTERS.find((f) => f.key === filterKey) ?? STATUS_FILTERS[0];

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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/safety" className="hover:text-foreground">
              ← Safety SMS
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Events that have occurred — bird strikes, near-misses, gear
            events, spills. File one below or triage the inbox.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety/actions"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            Corrective Actions
          </Link>
          <Link
            href="/safety/incidents/report"
            className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
          >
            + File an Incident
          </Link>
        </div>
      </header>

      <nav
        aria-label="Filter by status"
        className="mb-4 flex flex-wrap items-center gap-1.5"
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
              className={
                "rounded-md border px-2.5 py-1 text-xs font-semibold transition " +
                (isActive
                  ? "border-status-blue bg-status-blue/15 text-status-blue"
                  : "border-border bg-card text-muted-foreground hover:text-foreground")
              }
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
          <p className="mt-2 text-xs text-muted-foreground/70">
            A clean board is a good day.
          </p>
        </div>
      ) : (
        <IncidentTable incidents={incidents} total={total} />
      )}
    </div>
  );
}

function IncidentTable({
  incidents,
  total,
}: {
  incidents: Incident[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
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
              <tr key={i.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {new Date(i.occurred_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
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
                    className="text-xs font-semibold text-status-blue hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border px-4 py-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} incident{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

function SeverityChip({ severity }: { severity: Incident["severity"] }) {
  const cls =
    severity === "critical"
      ? "border-status-red bg-status-red/15 text-status-red"
      : severity === "high"
        ? "border-status-red/60 bg-status-red/10 text-status-red"
        : severity === "medium"
          ? "border-status-yellow bg-status-yellow/15 text-status-yellow"
          : "border-border bg-muted/20 text-muted-foreground";
  return (
    <span
      className={
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider " +
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
      ? "border-status-blue bg-status-blue/15 text-status-blue"
      : status === "triaged" || status === "in_progress"
        ? "border-status-yellow bg-status-yellow/15 text-status-yellow"
        : "border-border bg-muted/20 text-muted-foreground";
  return (
    <span
      className={
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {HAZARD_STATUS_LABELS[status]}
    </span>
  );
}

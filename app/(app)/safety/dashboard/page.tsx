import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  CAPA_STATUS_LABELS,
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS,
  listCapas,
  listHazards,
  listIncidents,
  type CorrectiveAction,
  type HazardReport,
  type HazardSeverity,
  type Incident,
} from "@/lib/api/safety";

/**
 * /safety/dashboard — Safety SMS Dashboard.
 *
 * Rollup of the three safety-service surfaces (hazards, incidents,
 * corrective actions). Read-only landing for Safety Officers / Chief
 * Pilots that want a single glance instead of clicking through the
 * three triage inboxes:
 *
 *   1. 4 stat cards: Open Hazards · Open Incidents · Open CAPAs · Past-Due CAPAs
 *   2. Recent Hazards + Recent Incidents lists
 *   3. Past-due CAPAs table (nudges the owner to act)
 *
 * Cascading state is intentionally NOT invalidated on edit — this is
 * a monitoring surface; edits happen on the item's own detail page.
 *
 * Sits alongside /safety (triage inbox), /safety/mine (reporter view),
 * /safety/incidents (incident triage), /safety/actions (CAPA board).
 */
export const dynamic = "force-dynamic";

// "Open" = anything not closed. The backend list endpoint accepts a
// single status filter, so we hit each open bucket in parallel.
const OPEN_HAZARD_STATUSES = ["submitted", "triaged", "in_progress"] as const;
const OPEN_INCIDENT_STATUSES = ["submitted", "triaged", "in_progress"] as const;

export default async function SafetyDashboardPage() {
  let openHazards: HazardReport[] = [];
  let openIncidents: Incident[] = [];
  let openCapas: CorrectiveAction[] = [];
  let overdueCapas: CorrectiveAction[] = [];
  let loadError: string | null = null;

  try {
    // Pull each open status separately, in parallel — the safety
    // endpoint accepts a single status filter at a time.
    const [hazardBuckets, incidentBuckets, capasResp, overdueResp] =
      await Promise.all([
        Promise.all(
          OPEN_HAZARD_STATUSES.map((s) =>
            listHazards({ status: s, limit: 50 }),
          ),
        ),
        Promise.all(
          OPEN_INCIDENT_STATUSES.map((s) =>
            listIncidents({ status: s, limit: 50 }),
          ),
        ),
        // "open" CAPAs = server-side status; add in_progress via a
        // second call so both counts land in the same aggregate.
        Promise.all([
          listCapas({ status: "open", limit: 100 }),
          listCapas({ status: "in_progress", limit: 100 }),
        ]),
        listCapas({ overdue_only: true, limit: 50 }),
      ]);

    openHazards = hazardBuckets.flatMap((r) => r.items);
    openIncidents = incidentBuckets.flatMap((r) => r.items);
    openCapas = capasResp.flatMap((r) => r.items);
    overdueCapas = overdueResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Safety dashboard unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 flex items-center text-xs">
        <Link
          href="/home"
          aria-label="Home"
          className="inline-flex items-center text-muted-foreground hover:text-foreground"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-3.5 w-3.5"
            aria-hidden
          >
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/safety"
          className="text-muted-foreground hover:text-foreground"
        >
          Safety
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="font-semibold text-status-blue">Dashboard</span>
      </nav>

      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            Safety SMS
          </div>
          <h1 className="mt-0.5 text-2xl font-bold sm:text-3xl">
            Safety Dashboard
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Open hazards, incidents, and corrective actions across the tenant —
            one glance surface for Safety Officers + Chief Pilots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            Hazard triage
          </Link>
          <Link
            href="/safety/incidents"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            Incident triage
          </Link>
          <Link
            href="/safety/actions"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            CAPA board
          </Link>
          <Link
            href="/safety/report"
            className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            + File a report
          </Link>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <StatCards
            openHazards={openHazards}
            openIncidents={openIncidents}
            openCapas={openCapas}
            overdueCapas={overdueCapas}
          />

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <RecentHazardsCard hazards={openHazards} />
            <RecentIncidentsCard incidents={openIncidents} />
          </div>

          <div className="mt-6">
            <OverdueCapasCard capas={overdueCapas} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCards({
  openHazards,
  openIncidents,
  openCapas,
  overdueCapas,
}: {
  openHazards: HazardReport[];
  openIncidents: Incident[];
  openCapas: CorrectiveAction[];
  overdueCapas: CorrectiveAction[];
}) {
  const criticalHazards = openHazards.filter(
    (h) => h.severity === "critical" || h.severity === "high",
  ).length;
  const criticalIncidents = openIncidents.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        value={openHazards.length}
        label="Open Hazards"
        hint={
          criticalHazards > 0
            ? `${criticalHazards} high/critical`
            : "None high"
        }
        tone={criticalHazards > 0 ? "yellow" : "green"}
        href="/safety"
      />
      <StatCard
        value={openIncidents.length}
        label="Open Incidents"
        hint={
          criticalIncidents > 0
            ? `${criticalIncidents} high/critical`
            : "None high"
        }
        tone={criticalIncidents > 0 ? "yellow" : "green"}
        href="/safety/incidents"
      />
      <StatCard
        value={openCapas.length}
        label="Open CAPAs"
        hint="Corrective + preventive actions"
        tone={openCapas.length > 0 ? "blue" : "green"}
        href="/safety/actions"
      />
      <StatCard
        value={overdueCapas.length}
        label="Past-Due CAPAs"
        hint={overdueCapas.length > 0 ? "Nudge the owner" : "All on track"}
        tone={overdueCapas.length > 0 ? "red" : "green"}
        href="/safety/actions"
      />
    </div>
  );
}

function StatCard({
  value,
  label,
  hint,
  tone,
  href,
}: {
  value: number;
  label: string;
  hint: string;
  tone: "green" | "yellow" | "red" | "blue";
  href: string;
}) {
  const toneClass = {
    green: "text-status-green",
    yellow: "text-status-yellow",
    red: "text-status-red",
    blue: "text-status-blue",
  }[tone];
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/5"
    >
      <div className={"text-2xl font-bold " + toneClass}>{value}</div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[0.7rem] text-muted-foreground/80">
        {hint}
      </div>
    </Link>
  );
}

function RecentHazardsCard({ hazards }: { hazards: HazardReport[] }) {
  const sorted = [...hazards]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Open Hazards
        </h2>
        <Link
          href="/safety"
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          Triage inbox →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState message="No open hazards. Nice work." />
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/safety/${h.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/5"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-1 font-medium">
                      {h.description || "(no description)"}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {HAZARD_CATEGORY_LABELS[h.category] ?? h.category}
                      {" · "}
                      {HAZARD_STATUS_LABELS[h.status] ?? h.status}
                      {" · "}
                      {fmtDate(h.created_at)}
                    </div>
                  </div>
                  <SeverityBadge severity={h.severity} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function RecentIncidentsCard({ incidents }: { incidents: Incident[] }) {
  const sorted = [...incidents]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Open Incidents
        </h2>
        <Link
          href="/safety/incidents"
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          Incident triage →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState message="No open incidents." />
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/safety/incidents/${i.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/5"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-1 font-medium">
                      {i.description || "(no description)"}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {INCIDENT_CATEGORY_LABELS[i.category] ?? i.category}
                      {" · "}
                      {HAZARD_STATUS_LABELS[i.status] ?? i.status}
                      {" · "}
                      {fmtDate(i.created_at)}
                    </div>
                  </div>
                  <SeverityBadge severity={i.severity} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function OverdueCapasCard({ capas }: { capas: CorrectiveAction[] }) {
  const sorted = [...capas].sort((a, b) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? ""),
  );
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Past-Due CAPAs
        </h2>
        <Link
          href="/safety/actions"
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          CAPA board →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState message="No past-due CAPAs. All on track." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Action</th>
                  <th className="px-3 py-2.5 font-semibold">Owner</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 font-semibold">Due</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((c) => {
                  const days = daysPastDue(c.due_date);
                  return (
                    <tr key={c.id} className="hover:bg-muted/5">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/safety/actions/${c.id}`}
                          className="font-medium text-status-blue hover:underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {c.owner?.full_name ?? c.owner?.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[0.7rem] text-muted-foreground">
                        {c.source_type}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="font-mono text-xs">
                          {c.due_date}
                        </span>
                        {days > 0 && (
                          <span className="ml-2 text-[0.65rem] font-semibold text-status-red">
                            {days}d past
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <CapaStatusBadge status={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function SeverityBadge({ severity }: { severity: HazardSeverity }) {
  const map: Record<HazardSeverity, [string, string]> = {
    low: ["border-status-green/40 bg-status-green/10 text-status-green", "Low"],
    medium: [
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
      "Medium",
    ],
    high: [
      "border-status-yellow/60 bg-status-yellow/15 text-status-yellow",
      "High",
    ],
    critical: [
      "border-status-red/40 bg-status-red/10 text-status-red",
      "Critical",
    ],
  };
  const [cls, label] = map[severity] ?? [
    "border-border bg-muted/20 text-muted-foreground",
    HAZARD_SEVERITY_LABELS[severity] ?? severity,
  ];
  return (
    <span
      className={
        "flex-shrink-0 rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

function CapaStatusBadge({ status }: { status: CorrectiveAction["status"] }) {
  const map: Record<CorrectiveAction["status"], string> = {
    open: "border-status-red/40 bg-status-red/10 text-status-red",
    in_progress:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    closed: "border-status-green/40 bg-status-green/10 text-status-green",
  };
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        (map[status] ?? "border-border bg-muted/20 text-muted-foreground")
      }
    >
      {CAPA_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function daysPastDue(dueIso: string): number {
  const due = new Date(`${dueIso}T00:00:00Z`);
  if (!Number.isFinite(due.getTime())) return 0;
  const now = new Date();
  const diff = Math.floor((now.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
}

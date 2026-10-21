import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  CAPA_SOURCE_LABELS,
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
import {
  SAFETY_REPORT_TYPE_LABELS,
  type SafetyReport,
  type SafetyReportSummary,
  getSafetyReportSummary,
  listSafetyReports,
} from "@/lib/api/safety-reports";
import { StatusBadge as ReportStatusBadge } from "@/components/safety/safety-report-badges";

/**
 * /safety/dashboard — Safety SMS Dashboard.
 *
 * Rollup of the safety-service surfaces (safety reports, hazards,
 * incidents, corrective actions). Read-only landing for Safety Officers /
 * Chief Pilots that want a single glance instead of clicking through the
 * triage inboxes:
 *
 *   1. 5 stat cards: Open Reports · Open Hazards · Open Incidents ·
 *      Open CAPAs · Past-Due CAPAs
 *   2. Legacy's 6-month report trend + Recent Reports (#58)
 *   3. Recent Hazards + Recent Incidents lists
 *   4. Past-due CAPAs table (nudges the owner to act)
 *
 * The report widgets load on their own: if safety reports cannot be
 * read, the rest of the dashboard still shows.
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

  // Separate from the rest, and soft: see the note above.
  const [reportSummary, recentReports] = await Promise.all([
    getSafetyReportSummary().catch(() => null),
    listSafetyReports({ limit: 5 })
      .then((r) => r.items)
      .catch(() => null),
  ]);

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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link
          href="/home"
          className="hover:text-foreground"
        >
          Home
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <Link
          href="/safety"
          className="hover:text-foreground"
        >
          Safety
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          ›
        </span>
        <span className="text-foreground">Dashboard</span>
      </nav>

      <header className="mb-5 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1">
            Safety SMS
          </div>
          <h1 className="page-title">
            Safety Dashboard
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Open safety reports, hazards, incidents and corrective actions
            across the tenant — one glance surface for Safety Officers + Chief
            Pilots.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety/reports"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Safety reports
          </Link>
          <Link
            href="/safety"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Hazard triage
          </Link>
          <Link
            href="/safety/incidents"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Incident triage
          </Link>
          <Link
            href="/safety/actions"
            className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent text-[0.72rem]"
          >
            CAPA board
          </Link>
          <Link
            href="/safety/reports/new"
            className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark text-[0.72rem]"
          >
            + File a report
          </Link>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <StatCards
            reportSummary={reportSummary}
            openHazards={openHazards}
            openIncidents={openIncidents}
            openCapas={openCapas}
            overdueCapas={overdueCapas}
          />

          {reportSummary && recentReports ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <ReportTrendCard summary={reportSummary} />
              <RecentReportsCard reports={recentReports} />
            </div>
          ) : null}

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
  reportSummary,
  openHazards,
  openIncidents,
  openCapas,
  overdueCapas,
}: {
  reportSummary: SafetyReportSummary | null;
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
    <div className={"grid grid-cols-2 gap-x-6 gap-y-4 " + (reportSummary ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
      {reportSummary ? (
        <StatCard
          value={reportSummary.open}
          label="Open Reports"
          hint={
            reportSummary.open_high_risk > 0
              ? `${reportSummary.open_high_risk} high risk`
              : "None high risk"
          }
          tone={reportSummary.open_high_risk > 0 ? "red" : reportSummary.open > 0 ? "yellow" : "green"}
          href="/safety/reports"
        />
      ) : null}
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
      className="block border-l-2 border-input py-1 pl-3 transition-colors hover:bg-accent/40"
    >
      <div className={"font-display text-[1.75rem] font-extrabold leading-none tabular-nums " + toneClass}>{value}</div>
      <div className="eyebrow mt-1.5">
        {label}
      </div>
      <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
        {hint}
      </div>
    </Link>
  );
}

/** Legacy's "Safety Reports — 6 Month Trend": a bar a month, by the day
 *  each report says it happened. */
function ReportTrendCard({ summary }: { summary: SafetyReportSummary }) {
  const max = Math.max(1, ...summary.by_month.map((m) => m.count));
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="eyebrow">
          Safety Reports — 6 Month Trend
        </h2>
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-4">
        <div className="flex h-28 items-end gap-1.5">
          {summary.by_month.map((m) => (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[0.65rem] tabular-nums text-muted-foreground">{m.count}</span>
              <div
                className="w-full rounded-t bg-primary"
                style={{ height: `${Math.max(4, Math.round((m.count / max) * 80))}%` }}
                aria-hidden
              />
              <span className="text-[0.6rem] uppercase tracking-[0.04em] text-muted-foreground">
                {monthLabel(m.month)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {summary.this_year} report{summary.this_year === 1 ? "" : "s"} year-to-date
        </p>
      </div>
    </section>
  );
}

function RecentReportsCard({ reports }: { reports: SafetyReport[] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="eyebrow">
          Recent Reports
        </h2>
        <Link href="/safety/reports" className="text-[0.7rem] font-semibold text-primary hover:underline">
          All reports →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {reports.length === 0 ? (
          <EmptyState message="No reports yet." />
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/safety/reports/${r.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-1 font-medium">{r.title}</div>
                    <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {SAFETY_REPORT_TYPE_LABELS[r.report_type]} · {fmtDate(r.occurred_on + "T12:00:00Z")}
                    </div>
                  </div>
                  <ReportStatusBadge status={r.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/** "2026-10" -> "OCT". */
function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function RecentHazardsCard({ hazards }: { hazards: HazardReport[] }) {
  const sorted = [...hazards]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, 5);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="eyebrow">
          Recent Open Hazards
        </h2>
        <Link
          href="/safety"
          className="text-[0.7rem] font-semibold text-primary hover:underline"
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
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
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
        <h2 className="eyebrow">
          Recent Open Incidents
        </h2>
        <Link
          href="/safety/incidents"
          className="text-[0.7rem] font-semibold text-primary hover:underline"
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
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-accent"
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
        <h2 className="eyebrow">
          Past-Due CAPAs
        </h2>
        <Link
          href="/safety/actions"
          className="text-[0.7rem] font-semibold text-primary hover:underline"
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
              <thead className="ff-thead">
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
                    <tr key={c.id} className="hover:bg-accent">
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/safety/actions/${c.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {c.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                        {c.owner?.full_name ?? c.owner?.email ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-[0.7rem] text-muted-foreground">
                        {CAPA_SOURCE_LABELS[c.source_type] ?? c.source_type}
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
    low: ["text-status-green", "Low"],
    medium: [
      "text-status-yellow",
      "Medium",
    ],
    high: [
      "text-status-yellow",
      "High",
    ],
    critical: [
      "text-status-red",
      "Critical",
    ],
  };
  const [cls, label] = map[severity] ?? [
    "text-muted-foreground",
    HAZARD_SEVERITY_LABELS[severity] ?? severity,
  ];
  return (
    <span
      className={
        "status-mark flex-shrink-0 text-[0.65rem] " +
        cls
      }
    >
      {label}
    </span>
  );
}

function CapaStatusBadge({ status }: { status: CorrectiveAction["status"] }) {
  const map: Record<CorrectiveAction["status"], string> = {
    open: "text-status-red",
    in_progress:
      "text-status-yellow",
    closed: "text-status-green",
  };
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        (map[status] ?? "text-muted-foreground")
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

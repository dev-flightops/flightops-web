import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  SAFETY_REPORT_STATUSES,
  SAFETY_REPORT_STATUS_LABELS,
  SAFETY_REPORT_TYPE_LABELS,
  type SafetyReport,
  type SafetyReportStatus,
  listSafetyReports,
} from "@/lib/api/safety-reports";
import { hasAnyRole } from "@/lib/roles";
import { RiskBadge, StatusBadge } from "@/components/safety/safety-report-badges";
import { SAFETY_REPORT_REVIEWERS } from "@/lib/safety-roles";


/**
 * /safety/reports — the safety team's inbox of filed reports (#58), as
 * legacy's Safety Reports page: status chips, then Date, Type, Title,
 * Reporter, Status and Risk.
 *
 * Reviewers only; anyone else is sent to their own reports. ASAP
 * reports are left out by the service for a chief pilot, and anonymous
 * ones come back without a reporter for anyone but the Safety Officer
 * and Exec Admins.
 */
export default async function SafetyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!hasAnyRole(session?.roles ?? [], SAFETY_REPORT_REVIEWERS)) redirect("/safety/mine");

  const raw = (await searchParams).status;
  const status = SAFETY_REPORT_STATUSES.find((s) => s === raw);

  let reports: SafetyReport[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const response = await listSafetyReports({ status, limit: 200 });
    reports = response.items;
    total = response.total;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    loadError = "Safety reports are unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Safety Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything filed with the red Safety button, newest first.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/safety/dashboard"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent"
          >
            Dashboard
          </Link>
          <Link
            href="/safety/reports/new"
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
          >
            + File Report
          </Link>
        </div>
      </header>

      <StatusChips active={status} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No reports{status ? ` with status “${SAFETY_REPORT_STATUS_LABELS[status]}”` : ""}.
          </p>
        </div>
      ) : (
        <ReportTable reports={reports} total={total} />
      )}
    </div>
  );
}

function StatusChips({ active }: { active: SafetyReportStatus | undefined }) {
  const chips: { label: string; href: string; on: boolean }[] = [
    { label: "All", href: "/safety/reports", on: !active },
    ...SAFETY_REPORT_STATUSES.map((s) => ({
      label: SAFETY_REPORT_STATUS_LABELS[s],
      href: `/safety/reports?status=${s}`,
      on: active === s,
    })),
  ];
  return (
    <nav aria-label="Filter by status" className="mb-4 flex flex-wrap gap-1">
      {chips.map((c) => (
        <Link
          key={c.label}
          href={c.href}
          aria-current={c.on ? "page" : undefined}
          className={
            "rounded px-3 py-1.5 text-xs font-semibold transition " +
            (c.on ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent hover:text-foreground")
          }
        >
          {c.label}
        </Link>
      ))}
    </nav>
  );
}

function ReportTable({ reports, total }: { reports: SafetyReport[]; total: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/60 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Title</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Reporter</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Risk</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {reports.map((r) => (
              <tr key={r.id} className="hover:bg-accent">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{shortDate(r.occurred_on)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="inline-flex rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                    {SAFETY_REPORT_TYPE_LABELS[r.report_type]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link href={`/safety/reports/${r.id}`} className="font-medium text-primary hover:underline">
                    {r.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {/* Anonymous even for the Safety Officer, who may see the
                      name: a list is read over shoulders. The report's own
                      page shows it to them. */}
                  {r.is_anonymous ? (
                    <span className="italic">Anonymous</span>
                  ) : (
                    (r.reporter?.full_name ?? "—")
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <RiskBadge score={r.risk_score} level={r.risk_level} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border px-4 py-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} report{total === 1 ? "" : "s"}
        {total > reports.length ? ` · newest ${reports.length} shown` : ""}
      </footer>
    </div>
  );
}

/** "2026-10-08" -> "10/08/26", legacy's column format. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

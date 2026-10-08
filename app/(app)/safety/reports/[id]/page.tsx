import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { CorrectiveActionPanel } from "@/components/safety/corrective-action-panel";
import { RiskBadge, StatusBadge } from "@/components/safety/safety-report-badges";
import { ApiError } from "@/lib/api/client";
import { listCapasForSource } from "@/lib/api/safety";
import {
  LIKELIHOOD_LABELS,
  SAFETY_REPORT_TYPE_LABELS,
  SEVERITY_LABELS,
  type SafetyReport,
  getSafetyReport,
  listSafetyReportReviewers,
  safetyReportAttachmentHref,
} from "@/lib/api/safety-reports";
import { hasAnyRole } from "@/lib/roles";
import { safeReturnPath } from "@/lib/safety/return-path";
import { ASAP_REVIEWERS, MANAGE_ROLES, SAFETY_REPORT_REVIEWERS } from "@/lib/safety-roles";

import { type AssigneeOption, ReviewForm } from "./review-form";

/**
 * /safety/reports/[id] — one safety report (#58), laid out as legacy's:
 * the account and what came of it on the left, the details and the
 * review on the right.
 *
 * Read by the safety team and by whoever filed it. Anyone else gets the
 * same 404 as a report that does not exist, and an ASAP report is not
 * the chief pilot's to read (the service decides both). The person who
 * filed it sees the report and its outcome, without the review controls
 * or the corrective actions, which are the safety team's.
 */
export default async function SafetyReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filed?: string; return_url?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const returnTo = safeReturnPath(query.return_url);
  const session = await auth();
  const roles = session?.roles ?? [];

  let report: SafetyReport;
  try {
    report = await getSafetyReport(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404 || err.status === 422) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  const reviewer = hasAnyRole(roles, SAFETY_REPORT_REVIEWERS);
  // A chief pilot can read an ASAP report they filed, but not review it.
  const canReview =
    reviewer && (report.report_type !== "asap" || hasAnyRole(roles, ASAP_REVIEWERS));
  const own = !!report.reporter && report.reporter.id === session?.user?.id;

  let capas: Awaited<ReturnType<typeof listCapasForSource>> | null = null;
  let assignees: AssigneeOption[] = [];
  if (canReview) {
    const [capaList, reviewers] = await Promise.all([
      listCapasForSource("safety_report", report.id).catch(() => null),
      listSafetyReportReviewers().catch(() => []),
    ]);
    capas = capaList;
    assignees = reviewers
      .filter((r) => report.report_type !== "asap" || r.sees_asap)
      .map((r) => ({ id: r.id, full_name: r.full_name }));
  }

  const back = returnTo
    ? { href: returnTo, label: "← Back" }
    : reviewer
      ? { href: "/safety/reports", label: "← Safety Reports" }
      : { href: "/safety/mine", label: "← My Reports" };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <Link href={back.href} className="hover:text-foreground">
          {back.label}
        </Link>
      </p>

      <header className="mb-5 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{report.title}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-semibold">
              {SAFETY_REPORT_TYPE_LABELS[report.report_type]}
            </span>
            <Reporter report={report} own={own} />
            <span className="font-mono">{longDate(report.occurred_on)}</span>
            <RiskBadge score={report.risk_score} level={report.risk_level} long />
          </div>
        </div>
        <StatusBadge status={report.status} />
      </header>

      {query.filed === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Safety report submitted. The safety team has been notified, and you can follow it under My
          Reports.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Description">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{report.description}</p>
          </Panel>

          {report.attachment ? (
            <Panel title="Attachment">
              <Attachment report={report} />
            </Panel>
          ) : null}

          {report.resolution ? (
            <Panel title="Resolution">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{report.resolution}</p>
            </Panel>
          ) : null}

          {canReview && capas ? (
            <CorrectiveActionPanel
              sourceType="safety_report"
              sourceId={report.id}
              items={capas.items}
              canOpen={hasAnyRole(roles, MANAGE_ROLES)}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Panel title="Details">
            <dl className="space-y-2 text-sm">
              <Detail label="Location" value={report.location} />
              <Detail label="Flight" value={report.flight_number} />
              <Detail label="Aircraft" value={report.aircraft_tail} />
              <Detail label="Department" value={report.reporter_department} />
              <Detail
                label="Severity"
                value={report.severity ? `${report.severity} — ${SEVERITY_LABELS[report.severity]}` : null}
              />
              <Detail
                label="Likelihood"
                value={report.likelihood ? `${report.likelihood} — ${LIKELIHOOD_LABELS[report.likelihood]}` : null}
              />
              <Detail label="Assigned To" value={report.assigned_to?.full_name} />
              <Detail label="Filed" value={new Date(report.created_at).toLocaleString()} />
              <Detail
                label="Reviewed"
                value={
                  report.reviewed_at
                    ? `${new Date(report.reviewed_at).toLocaleString()} by ${report.reviewed_by?.full_name ?? "unknown"}`
                    : null
                }
              />
              <Detail
                label="Closed"
                value={
                  report.closed_at
                    ? `${new Date(report.closed_at).toLocaleString()} by ${report.closed_by?.full_name ?? "unknown"}`
                    : null
                }
              />
            </dl>
          </Panel>

          {canReview ? (
            <Panel title="Update Status">
              <ReviewForm report={report} assignees={assignees} />
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Who filed it, as far as this reader may know. */
function Reporter({ report, own }: { report: SafetyReport; own: boolean }) {
  if (!report.is_anonymous) return <span>{report.reporter?.full_name ?? "Unknown reporter"}</span>;
  return (
    <>
      <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-semibold">Anonymous</span>
      {own ? (
        <span>You filed this anonymously.</span>
      ) : report.reporter ? (
        <span>
          Filed by {report.reporter.full_name}; other reviewers see only &ldquo;Anonymous&rdquo;.
        </span>
      ) : null}
    </>
  );
}

function Attachment({ report }: { report: SafetyReport }) {
  const href = safetyReportAttachmentHref(report.id);
  const file = report.attachment!;
  if (file.content_type === "application/pdf") {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-accent"
      >
        View PDF: {file.filename}
      </a>
    );
  }
  return (
    <>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <img
          src={href}
          alt={`Attached to “${report.title}”`}
          className="max-h-80 max-w-full rounded-lg bg-muted object-contain"
        />
      </a>
      <p className="mt-1 text-xs text-muted-foreground">{file.filename}</p>
    </>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

/** "2026-10-08" -> "Oct 08, 2026", legacy's header format. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${String(d).padStart(2, "0")}, ${y}`;
}

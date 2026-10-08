import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  ASAP_DECISIONS,
  ASAP_DECISION_CARD_LABELS,
  ASAP_DECISION_LABELS,
  ASAP_MOU_CATEGORY,
  type AsapDecision,
  type AsapHub,
  type AsapReview,
  getAsapHub,
} from "@/lib/api/asap";
import { ApiError } from "@/lib/api/client";
import { type DocumentRow, downloadUrl, listDocuments } from "@/lib/api/documents";
import type { SafetyReport } from "@/lib/api/safety-reports";
import { hasAnyRole } from "@/lib/roles";
import { ASAP_REVIEWERS, SAFETY_REPORT_REVIEWERS } from "@/lib/safety-roles";

import { AsapReviewForm } from "./review-form";

/**
 * /safety/asap — the ASAP hub (#59), as legacy's: the count per ERC
 * decision, the company's FAA ASAP MOU, and every ASAP report with the
 * Event Review Committee's review and a form to record or revise it.
 *
 * The Safety Officer, the DO and Exec Admins only (Greg, 8 Oct), as ASAP
 * reports themselves. The MOU is a document in the library under the
 * "ASAP MOU" category; legacy kept it in a policy library we don't have.
 */
export default async function AsapHubPage() {
  const session = await auth();
  const roles = session?.roles ?? [];
  if (!hasAnyRole(roles, ASAP_REVIEWERS)) {
    redirect(hasAnyRole(roles, SAFETY_REPORT_REVIEWERS) ? "/safety/reports" : "/safety/mine");
  }

  let hub: AsapHub | null = null;
  let loadError: string | null = null;
  try {
    hub = await getAsapHub();
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    loadError = "The ASAP program is unavailable. Try refreshing in a moment.";
  }
  // The MOU list is a nicety on this page; a library hiccup shouldn't hide the reviews.
  const mou: DocumentRow[] | null = await listDocuments({ category: ASAP_MOU_CATEGORY })
    .then((r) => r.items)
    .catch(() => null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <Link href="/safety/dashboard" className="hover:text-foreground">
          ← SMS Dashboard
        </Link>
      </p>
      <header className="mb-5 mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aviation Safety Action Program (ASAP)</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report filing · ERC review · FAA MOU · Decision tracking
          </p>
        </div>
        <Link
          href="/safety/reports/new?type=asap"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
        >
          + File ASAP Report
        </Link>
      </header>

      {loadError || !hub ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : (
        <>
          <DecisionCards counts={hub.counts} />
          <MouPanel docs={mou} />
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">ASAP Reports</h2>
          {hub.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">No ASAP reports filed yet.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {hub.items.map(({ report, review }) => (
                <li key={report.id} id={`report-${report.id}`}>
                  <ReportCard report={report} review={review} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const DECISION_TONE: Record<AsapDecision, string> = {
  pending: "text-status-yellow",
  accepted: "text-status-green",
  accepted_ns: "text-status-blue",
  excluded: "text-status-red",
  withdrawn: "text-muted-foreground",
};

function DecisionCards({ counts }: { counts: AsapHub["counts"] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
      {ASAP_DECISIONS.map((d) => (
        <div key={d} className="rounded-lg border border-border bg-card px-3 py-3">
          <div className={`text-2xl font-bold tabular-nums ${DECISION_TONE[d]}`}>{counts[d] ?? 0}</div>
          <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            {ASAP_DECISION_CARD_LABELS[d]}
          </div>
        </div>
      ))}
    </div>
  );
}

function MouPanel({ docs }: { docs: DocumentRow[] | null }) {
  return (
    <section className="mb-5 rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          FAA / ASAP MOU Documents
        </h2>
        <Link href="/documents" className="text-xs font-semibold text-primary hover:underline">
          Upload MOU →
        </Link>
      </header>
      {docs === null ? (
        <p className="text-xs text-muted-foreground">The document library couldn&rsquo;t be read just now.</p>
      ) : docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No MOU on file. Upload your FAA ASAP Memorandum of Understanding to the document library under
          the category &ldquo;{ASAP_MOU_CATEGORY}&rdquo;.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-foreground">
                  {d.title}{" "}
                  <span className="font-normal text-muted-foreground">v{d.current_version_number}</span>
                </div>
              </div>
              {d.current_version_id ? (
                <a
                  href={downloadUrl(d.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border bg-background px-2.5 py-1 font-semibold text-foreground/80 hover:bg-accent"
                >
                  View
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportCard({ report, review }: { report: SafetyReport; review: AsapReview | null }) {
  const decision = review?.decision ?? "pending";
  const description =
    report.description.length > 250 ? `${report.description.slice(0, 250)}...` : report.description;
  const facts = [
    report.is_anonymous ? "Anonymous" : (report.reporter?.full_name ?? "Unknown reporter"),
    `Filed ${shortDate(report.occurred_on)}`,
    report.flight_number,
    report.aircraft_tail,
  ].filter(Boolean);

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">
            <Link href={`/safety/reports/${report.id}`} className="text-foreground hover:text-primary hover:underline">
              {report.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">{facts.join(" · ")}</p>
        </div>
        <DecisionBadge decision={decision} reviewed={!!review} />
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/90">{description}</p>

      {review ? (
        <div className="mt-3 border-t border-border pt-3 text-xs">
          <div className="mb-1 font-bold text-status-blue">ERC Review — {shortDate(review.review_date)}</div>
          {review.erc_participants ? (
            <div className="text-muted-foreground">
              <strong>Participants:</strong> {review.erc_participants}
            </div>
          ) : null}
          {review.decision_rationale ? (
            <div className="mt-1 whitespace-pre-wrap">
              <strong className="text-muted-foreground">Rationale:</strong> {review.decision_rationale}
            </div>
          ) : null}
          {review.corrective_action_summary ? (
            <div className="mt-1 whitespace-pre-wrap">
              <strong className="text-muted-foreground">Actions:</strong> {review.corrective_action_summary}
            </div>
          ) : null}
          {review.de_identified ? (
            <div className="mt-1 text-status-green">✓ De-identified before sharing</div>
          ) : null}
          <div className="mt-1 text-muted-foreground">
            {review.closed_date ? `Closed ${shortDate(review.closed_date)} · ` : ""}
            Last saved by {review.reviewed_by?.full_name ?? "unknown"}
          </div>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          {review ? "Update review" : "File ERC review"}
        </summary>
        <AsapReviewForm reportId={report.id} review={review} />
      </details>
    </article>
  );
}

function DecisionBadge({ decision, reviewed }: { decision: AsapDecision; reviewed: boolean }) {
  const tone =
    decision === "pending"
      ? "border-status-yellow/50 bg-status-yellow/15 text-status-yellow"
      : decision === "accepted" || decision === "accepted_ns"
        ? "border-status-green/50 bg-status-green/10 text-status-green"
        : decision === "excluded"
          ? "border-status-red/50 bg-status-red/10 text-status-red"
          : "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${tone}`}
    >
      {reviewed ? ASAP_DECISION_LABELS[decision] : "Pending Review"}
    </span>
  );
}

/** "2026-10-08" -> "Oct 08, 2026", legacy's format. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${month} ${String(d).padStart(2, "0")}, ${y}`;
}

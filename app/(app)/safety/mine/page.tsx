import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { RiskBadge, StatusBadge } from "@/components/safety/safety-report-badges";
import { ApiError } from "@/lib/api/client";
import {
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  type HazardReport,
  listMyHazards,
} from "@/lib/api/safety";
import {
  SAFETY_REPORT_TYPE_LABELS,
  type SafetyReport,
  listMySafetyReports,
} from "@/lib/api/safety-reports";

/**
 * /safety/mine — Reporter's own submissions feed.
 *
 * Every authenticated user can see this; anonymity is a no-op here
 * because you're viewing your own reports (the /mine backend endpoints
 * don't gate on triage roles and always return the reporter).
 *
 * Safety reports first: since #58 the red button files one. Hazards
 * follow, for anyone who has filed one; the hazard form is the safety
 * team's now, so most people have none and the section is left out.
 */
export default async function MySafetyReportsPage() {
  const [reportsResult, hazardsResult] = await Promise.allSettled([
    listMySafetyReports(200),
    listMyHazards({ limit: 200 }),
  ]);
  const failed = [reportsResult, hazardsResult].find((r) => r.status === "rejected");
  const reports: SafetyReport[] = reportsResult.status === "fulfilled" ? reportsResult.value.items : [];
  const hazards: HazardReport[] = hazardsResult.status === "fulfilled" ? hazardsResult.value.items : [];
  let loadError: string | null = null;
  if (failed) {
    const err = (failed as PromiseRejectedResult).reason;
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Some of your reports could not be loaded. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link href="/safety" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Safety SMS
        </Link>
          <h1 className="mt-2 page-title">My Reports</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Everything you&rsquo;ve filed, and where the safety team has got
            to with it.
          </p>
        </div>
        <Link
          href="/safety/reports/new"
          className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:border-foreground text-[0.72rem]"
        >
          + File a Safety Report
        </Link>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : null}

      {reports.length === 0 && hazards.length === 0 ? (
        loadError ? null : (
          <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              You haven&rsquo;t filed any safety reports yet.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              If you see something worth flagging, use the red Safety button in
              the bottom-right — or the &ldquo;File a Safety Report&rdquo; button
              above.
            </p>
          </div>
        )
      ) : null}

      {reports.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-2 eyebrow">
            Safety reports
          </h2>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/safety/reports/${r.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-baseline gap-2">
                      <span className="eyebrow">
                        {SAFETY_REPORT_TYPE_LABELS[r.report_type]}
                        {r.is_anonymous ? " · Anonymous" : ""}
                      </span>
                      <span className="text-[0.6875rem] text-muted-foreground">
                        Filed {new Date(r.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className="line-clamp-2 font-medium text-foreground/90">{r.title}</p>
                  </div>
                  <span className="flex items-center gap-2">
                    <RiskBadge score={r.risk_score} level={r.risk_level} />
                    <StatusBadge status={r.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hazards.length > 0 ? (
        <section>
          <h2 className="mb-2 eyebrow">
            Hazards
          </h2>
        <ul className="space-y-2">
          {hazards.map((h) => (
            <li key={h.id}>
              <Link
                href={`/safety/${h.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="eyebrow">
                      {HAZARD_SEVERITY_LABELS[h.severity]} ·{" "}
                      {HAZARD_CATEGORY_LABELS[h.category]}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      Filed {new Date(h.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-foreground/90">
                    {h.description}
                  </p>
                </div>
                <span className="whitespace-nowrap eyebrow">
                  {HAZARD_STATUS_LABELS[h.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        </section>
      ) : null}
    </div>
  );
}

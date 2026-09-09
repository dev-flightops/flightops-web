"use client";

import { useState } from "react";

import type {
  SafetyIntelligence,
  SafetyRiskLevel,
  SafetyTrend,
} from "@/lib/api/ai";

import { runSafetyAnalysisAction, type AnalyseResult } from "./actions";

/**
 * Safety Intelligence — the analysis half of the page.
 *
 * Follows legacy `templates/ai/safety_intelligence.html`: a button
 * that runs the analysis, then executive summary, risk categories,
 * hotspots, trending issues and corrective focus. Same order, same
 * groupings, so somebody who used the old screen recognises this one.
 *
 * Three deliberate departures from legacy, all about the logic rather
 * than the look:
 *
 * 1. Legacy builds every panel with `innerHTML` from the model's
 *    output. That output is derived from safety reports, which people
 *    type — so a report containing markup becomes markup in the page.
 *    Rendering it as text closes that without anyone having to
 *    remember to escape.
 *
 * 2. Legacy shows `reports_omitted` nowhere, because legacy has no
 *    such idea: it analyses whatever it read and presents it as the
 *    picture. Ours says when it read a sample, because a partial
 *    analysis that looks complete is worse than no analysis.
 *
 * 3. The advisory is rendered from the payload rather than written
 *    into the page. The service sends it on every response for that
 *    reason — a page that supplies its own can drop it in a refactor
 *    and nobody notices.
 *
 * The run is manual, as in legacy. It spends a model call and takes
 * the best part of a minute, so it happens when somebody asks for it.
 */

function riskClasses(level: SafetyRiskLevel): string {
  if (level === "high") return "bg-status-red/15 text-status-red";
  if (level === "medium") return "bg-status-yellow/15 text-status-yellow";
  return "bg-status-green/15 text-status-green";
}

function trendClasses(trend: SafetyTrend): string {
  // Rising is the one that needs attention; declining is good news in
  // this context, so it takes the green rather than the red a "down"
  // arrow would suggest elsewhere.
  if (trend === "rising") return "bg-status-red/15 text-status-red";
  if (trend === "declining") return "bg-status-green/15 text-status-green";
  return "bg-muted/40 text-muted-foreground";
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="rounded-lg border border-border bg-card p-4"
    >
      <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function AnalysisPanel() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<AnalyseResult | null>(null);

  async function run() {
    setPending(true);
    setResult(null);
    // The service resolves the window against this zone. A server
    // component cannot read it, so it goes up from here.
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    setResult(await runSafetyAnalysisAction(tz));
    setPending(false);
  }

  const data: SafetyIntelligence | null =
    result?.status === "ok" ? result.data : null;
  const analysis = data?.analysis ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run()}
          disabled={pending}
          className="rounded-md border border-status-purple/40 bg-status-purple/10 px-4 py-2 text-xs font-semibold text-status-purple hover:bg-status-purple/20 disabled:opacity-50"
        >
          {pending ? "Analysing…" : "✦ Run AI Analysis"}
        </button>
        {pending && (
          <span role="status" className="text-xs text-muted-foreground">
            Reading the window and looking for patterns. This takes about a
            minute.
          </span>
        )}
      </div>

      {result && result.status !== "ok" && (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {result.message}
        </p>
      )}

      {data && (
        <>
          {/* From the payload, not written here — see the note above. */}
          <p className="rounded-md border border-status-blue/30 bg-status-blue/10 px-3 py-2 text-xs text-status-blue">
            {data.advisory}
          </p>

          <p className="text-xs text-muted-foreground">
            {data.hazard_count} hazard{data.hazard_count === 1 ? "" : "s"} and{" "}
            {data.incident_count} incident
            {data.incident_count === 1 ? "" : "s"} between{" "}
            <span className="font-semibold text-foreground">
              {data.window_start}
            </span>{" "}
            and{" "}
            <span className="font-semibold text-foreground">
              {data.window_end}
            </span>
            .
          </p>

          {data.reports_omitted > 0 && (
            // Said plainly and in warning colour. A sampled analysis
            // that reads as a complete one is the failure mode worth
            // guarding against here.
            <p
              role="status"
              className="rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              This analysis read a sample of the window —{" "}
              {data.reports_omitted} report
              {data.reports_omitted === 1 ? " was" : "s were"} not included.
              Treat it as indicative, not as a full picture.
            </p>
          )}

          {data.note && (
            <p
              role="status"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground"
            >
              {data.note}
            </p>
          )}

          {analysis && (
            <div className="space-y-4">
              <Panel title="Executive summary">
                <p className="text-sm leading-relaxed text-foreground">
                  {analysis.executive_summary || "No summary returned."}
                </p>
                {analysis.positive_trends.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                      Positive trends
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {analysis.positive_trends.map((t) => (
                        <li key={t} className="text-sm text-status-green">
                          + {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Panel>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Panel title="Risk categories">
                  {analysis.risk_categories.length === 0 ? (
                    <Empty>No categories identified.</Empty>
                  ) : (
                    <ul className="divide-y divide-border">
                      {analysis.risk_categories.map((c) => (
                        <li
                          key={c.category}
                          className="flex items-center justify-between gap-2 py-1.5 text-sm"
                        >
                          <span className="text-foreground">
                            {c.category}{" "}
                            <span className="tabular-nums text-muted-foreground">
                              ({c.count})
                            </span>
                          </span>
                          <span
                            className={
                              "rounded px-2 py-0.5 text-[0.65rem] font-semibold " +
                              trendClasses(c.trend)
                            }
                          >
                            {c.trend}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel title="Risk hotspots">
                  {analysis.hotspots.length === 0 ? (
                    <Empty>No hotspots identified.</Empty>
                  ) : (
                    <ul className="divide-y divide-border">
                      {analysis.hotspots.map((h) => (
                        <li key={h.location} className="py-1.5">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-foreground">{h.location}</span>
                            <span className="rounded bg-status-yellow/15 px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums text-status-yellow">
                              {h.report_count}
                            </span>
                          </div>
                          {h.primary_concern && (
                            <p className="text-xs text-muted-foreground">
                              {h.primary_concern}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <Panel title="Trending issues">
                {analysis.trending_issues.length === 0 ? (
                  <Empty>Nothing trending in this window.</Empty>
                ) : (
                  <ul className="divide-y divide-border">
                    {analysis.trending_issues.map((i) => (
                      <li key={i.issue} className="flex items-start gap-3 py-2">
                        <span
                          className={
                            "mt-0.5 shrink-0 rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase " +
                            riskClasses(i.risk_level)
                          }
                        >
                          {i.risk_level}
                        </span>
                        <div>
                          <p className="text-sm text-foreground">{i.issue}</p>
                          {i.frequency && (
                            <p className="text-xs text-muted-foreground">
                              Frequency: {i.frequency}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Recommended corrective focus">
                {analysis.corrective_focus.length === 0 ? (
                  <Empty>No corrective actions recommended.</Empty>
                ) : (
                  <ul className="divide-y divide-border">
                    {analysis.corrective_focus.map((f) => (
                      <li key={f.area} className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase " +
                              riskClasses(f.priority)
                            }
                          >
                            {f.priority}
                          </span>
                          <span className="text-sm font-semibold text-foreground">
                            {f.area}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {f.recommendation}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  );
}

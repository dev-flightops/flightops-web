import { CalendarClock } from "lucide-react";

import { DashboardNav, type DashboardSlug } from "./dashboard-nav";

interface PlaceholderDashboardProps {
  slug: DashboardSlug;
  /** Legacy title — appears as the H1 below the DashboardNav. */
  title: string;
  /** Single-line subtitle under the H1. Matches legacy text-xs muted style. */
  subtitle: string;
  /** Short one-line summary of what this dashboard will eventually show. */
  intro: string;
  /** Month / story when the underlying data will be ready. */
  availableAfter: string;
  /** Bullet list of metrics this dashboard will display. */
  upcomingMetrics: string[];
}

/**
 * Stub used by every dashboard whose underlying data services haven't
 * shipped yet (executive, director-ops, chief-pilot, station, ops-score,
 * system-health). Renders the same DashboardNav and title block layout
 * as the live dispatcher view, then a single dashed-border panel with a
 * "coming in M2/M3/M4" callout + the list of future metrics.
 *
 * Once a dashboard's services land, swap `<PlaceholderDashboard />` for
 * the real implementation — the DashboardNav at the top stays identical,
 * so users keep their bearings.
 */
export function PlaceholderDashboard({
  slug,
  title,
  subtitle,
  intro,
  availableAfter,
  upcomingMetrics,
}: PlaceholderDashboardProps) {
  return (
    <div className="container py-6">
      <DashboardNav active={slug} />

      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>

      <section className="mt-5 rounded-xl border border-dashed border-border bg-muted/20 p-6">
        <div className="flex items-start gap-4">
          <CalendarClock className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
          <div className="space-y-3">
            <p className="text-sm font-medium">
              Available after{" "}
              <span className="text-status-blue">{availableAfter}</span>
            </p>
            <p className="text-xs text-muted-foreground">{intro}</p>
            <ul className="ml-1 space-y-1.5 text-xs">
              {upcomingMetrics.map((metric) => (
                <li
                  key={metric}
                  className="before:mr-2 before:text-status-blue before:content-['→']"
                >
                  {metric}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

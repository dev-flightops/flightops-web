import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  HAZARD_CATEGORY_LABELS,
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  type HazardReport,
  listMyHazards,
} from "@/lib/api/safety";

/**
 * /safety/mine — Reporter's own submissions feed.
 *
 * Every authenticated user can see this; anonymity is a no-op here
 * because you're viewing your own reports (the /mine backend endpoint
 * doesn't gate on triage roles and always returns the reporter).
 */
export default async function MySafetyReportsPage() {
  let hazards: HazardReport[] = [];
  let loadError: string | null = null;
  try {
    const response = await listMyHazards({ limit: 200 });
    hazards = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/safety" className="hover:text-foreground">
              ← Safety SMS
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">My Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every hazard you&rsquo;ve filed, with the Safety Officer&rsquo;s
            status.
          </p>
        </div>
        <Link
          href="/safety/report"
          className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
        >
          + File a Hazard
        </Link>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : hazards.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&rsquo;t filed any hazards yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            If you see something worth flagging, use the red button in
            the bottom-right — or the &ldquo;File a Hazard&rdquo; button
            above.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {hazards.map((h) => (
            <li key={h.id}>
              <Link
                href={`/safety/${h.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {HAZARD_SEVERITY_LABELS[h.severity]} ·{" "}
                      {HAZARD_CATEGORY_LABELS[h.category]}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground/70">
                      Filed {new Date(h.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-foreground/90">
                    {h.description}
                  </p>
                </div>
                <span className="whitespace-nowrap rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {HAZARD_STATUS_LABELS[h.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

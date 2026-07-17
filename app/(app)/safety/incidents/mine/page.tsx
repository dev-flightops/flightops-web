import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  HAZARD_SEVERITY_LABELS,
  HAZARD_STATUS_LABELS,
  INCIDENT_CATEGORY_LABELS,
  type Incident,
  listMyIncidents,
} from "@/lib/api/safety";

export default async function MyIncidentsPage() {
  let incidents: Incident[] = [];
  let loadError: string | null = null;
  try {
    incidents = (await listMyIncidents({ limit: 200 })).items;
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
            <Link href="/safety/incidents" className="hover:text-foreground">
              ← Incidents
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            My Incident Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every incident you&rsquo;ve filed, with the Safety Officer&rsquo;s
            status.
          </p>
        </div>
        <Link
          href="/safety/incidents/report"
          className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
        >
          + File an Incident
        </Link>
      </header>

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
            You haven&rsquo;t filed any incidents.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {incidents.map((i) => (
            <li key={i.id}>
              <Link
                href={`/safety/incidents/${i.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {HAZARD_SEVERITY_LABELS[i.severity]} ·{" "}
                      {INCIDENT_CATEGORY_LABELS[i.category]}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground/70">
                      Occurred {new Date(i.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-foreground/90">
                    {i.description}
                  </p>
                </div>
                <span className="whitespace-nowrap rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                  {HAZARD_STATUS_LABELS[i.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

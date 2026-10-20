import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
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
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link href="/safety/incidents" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Incidents
        </Link>
          <h1 className="mt-2 page-title">
            My Incident Reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Every incident you&rsquo;ve filed, with the Safety Officer&rsquo;s
            status.
          </p>
        </div>
        <Link
          href="/safety/incidents/report"
          className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:border-foreground text-[0.72rem]"
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
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="eyebrow">
                      {HAZARD_SEVERITY_LABELS[i.severity]} ·{" "}
                      {INCIDENT_CATEGORY_LABELS[i.category]}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      Occurred {new Date(i.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-foreground/90">
                    {i.description}
                  </p>
                </div>
                <span className="whitespace-nowrap eyebrow">
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

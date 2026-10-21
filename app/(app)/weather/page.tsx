import { buttonSolid, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import Link from "next/link";

import { FlightCategoryBadge } from "@/components/weather/flight-category-badge";
import { ApiError } from "@/lib/api/client";
import { listWeatherBriefings } from "@/lib/api/weather";
import type { WeatherBriefingListItem } from "@/lib/api/types";

/**
 * /weather — saved Weather Briefings landing (M2-G-27 rebuild).
 *
 * Layout matches legacy `templates/weather_briefing/history.html`:
 *   - max-w-5xl, py-10 — narrower + more vertical breathing than the
 *     dispatcher's other list pages so the table doesn't feel as
 *     dense
 *   - "Weather Briefings" title + "Stored weather briefings for your
 *     operation" subtitle (verbatim from legacy)
 *   - "+ New Briefing" primary button top-right
 *   - 7-column table inside a single panel: Date/Time · Airports ·
 *     Flight · Aircraft · Conditions · Briefed By · View →
 *   - Empty state matches legacy: "No briefings yet." + "Create First
 *     Briefing" CTA inside the panel
 */

const BRIEFINGS_LIMIT = 100;

function formatBriefingTimestamp(iso: string): string {
  // "MM/DD HH:MM AKD" matches the legacy column format exactly.
  const d = new Date(iso);
  const md = d.toLocaleDateString("en-US", {
    timeZone: "America/Anchorage",
    month: "2-digit",
    day: "2-digit",
  });
  const hm = d.toLocaleTimeString("en-US", {
    timeZone: "America/Anchorage",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${md} ${hm} AKD`;
}

export default async function WeatherBriefingsPage() {
  let briefings: WeatherBriefingListItem[] = [];
  let loadError: string | null = null;

  try {
    briefings = (await listWeatherBriefings({ limit: BRIEFINGS_LIMIT })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    if (status === 404) {
      // Backend endpoint not built yet (or no briefings table seeded) —
      // render as empty so the page falls through to the "No briefings
      // yet" empty state + "Create First Briefing" CTA. Auto-upgrades
      // to the populated table the moment the endpoint ships.
      briefings = [];
    } else if (status === 401) {
      loadError = "Your session expired — please sign in again.";
    } else {
      loadError = "Briefings feed unavailable. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <PageHeader
        title="Weather Briefings"
        description="Stored weather briefings for your operation"
        actions={
          <Link href="/weather/new" className={buttonSolid}>
            + New Briefing
          </Link>
        }
      />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : briefings.length === 0 ? (
        <Panel flush>
          <EmptyState
            action={
              <Link href="/weather/new" className={buttonSolid}>
                Create First Briefing
              </Link>
            }
          >
            No briefings yet.
          </EmptyState>
        </Panel>
      ) : (
        <BriefingsTable briefings={briefings} />
      )}
    </div>
  );
}

function BriefingsTable({
  briefings,
}: {
  briefings: WeatherBriefingListItem[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="ff-thead">
            <th className="px-4 py-3">Date / Time</th>
            <th className="px-4 py-3">Airports</th>
            <th className="px-4 py-3">Flight</th>
            <th className="px-4 py-3">Aircraft</th>
            <th className="px-4 py-3">Conditions</th>
            <th className="px-4 py-3">Briefed By</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {briefings.map((b) => (
            <tr key={b.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {formatBriefingTimestamp(b.created_at)}
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {b.airports.join(", ")}
              </td>
              <td className="px-4 py-3 text-foreground">
                {b.flight?.flight_number ?? "—"}
              </td>
              <td className="px-4 py-3 text-foreground">
                {b.aircraft?.tail_number ?? "—"}
              </td>
              <td className="px-4 py-3">
                {b.worst_flight_category ? (
                  <FlightCategoryBadge category={b.worst_flight_category} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {b.briefed_by.full_name}
              </td>
              <td className="px-4 py-3 text-right">
                <Link href={`/weather/${b.id}`} className={linkCaps}>
                  View <span aria-hidden>›</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { Plane } from "lucide-react";

import { FleetMapLoader } from "@/components/flight-following/fleet-map-loader";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { ApiError } from "@/lib/api/client";
import { getLatestPositions } from "@/lib/api/flight-following";
import type { PositionResponse } from "@/lib/api/types";

/**
 * /flight-following — live fleet map (M2-G-8).
 *
 * Server component fetches `/positions/latest` once per server render;
 * the inner FleetMap client component polls `router.refresh()` every
 * 30 seconds to re-trigger this fetch (keeps the JWT server-side, no
 * client-side API client needed).
 *
 * One colored dot per aircraft that has ever had a position fix.
 * Source colour: green = ADS-B, blue = GPS, amber = manual relay,
 * grey = simulated (demo data). Click for tail / altitude / heading.
 *
 * Future stories:
 *   M2-G-9    — per-flight track polyline (click an aircraft → fetch
 *               /flights/{id}/track and draw it)
 *   M2-M-13c  — SSE on /positions/stream so the map updates without
 *               polling
 */
export default async function FlightFollowingPage() {
  let positions: PositionResponse[] = [];
  let loadError: string | null = null;
  let pulledAt: string | null = null;

  try {
    const response = await getLatestPositions();
    positions = response.items;
    // Newest reported_at across all aircraft → the "as of" stamp on
    // the page header. Demo data may have older timestamps, which is
    // honest — the dispatcher should see "data is from N min ago".
    pulledAt = positions
      .map((p) => p.reported_at)
      .sort()
      .pop() ?? null;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight-following feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Breadcrumb
            icon={<Plane className="h-3.5 w-3.5" />}
            segments={[
              { label: "Operations" },
              { label: "Flight Following" },
            ]}
          />
          <h1 className="mt-1 text-xl font-bold tracking-tight">
            Flight Following
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Live aircraft positions across the fleet. Auto-refreshes every
            30 s.{" "}
            {pulledAt && (
              <span className="text-muted-foreground/70">
                Most recent fix: {formatPulledAt(pulledAt)}.
              </span>
            )}
          </p>
        </div>
        <FleetCountBadge positions={positions} />
      </header>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card">
        {loadError ? (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {loadError}
          </div>
        ) : positions.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            No position data yet. The flight-following-service hasn&apos;t
            received any fixes for aircraft in your tenant.
            <br />
            (Demo seeder: <code>docker compose up seed-positions</code>)
          </div>
        ) : (
          <FleetMapLoader positions={positions} />
        )}
      </div>

      <p className="mt-3 text-[0.65rem] text-muted-foreground/70">
        Source colour: <span className="text-status-green">green</span> = ADS-B
        ·{" "}
        <span className="text-status-blue">blue</span> = GPS uplink ·{" "}
        <span className="text-status-yellow">amber</span> = manual radio
        relay · <span className="text-muted-foreground">grey</span> =
        simulated (demo data, M3 ADS-B adapter replaces).
      </p>
    </div>
  );
}

function FleetCountBadge({ positions }: { positions: PositionResponse[] }) {
  return (
    <span className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {positions.length} {positions.length === 1 ? "aircraft" : "aircraft"} tracked
    </span>
  );
}

function formatPulledAt(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}Z`;
}

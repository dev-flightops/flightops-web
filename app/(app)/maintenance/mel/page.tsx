import { AircraftFilter } from "@/components/maintenance/aircraft-filter";
import { MelTable } from "@/components/maintenance/mel-table";
import { StatusFilterTabs } from "@/components/maintenance/status-filter-tabs";
import { ApiError } from "@/lib/api/client";
import { listMelItems } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import type {
  AircraftListItem,
  MelItemResponse,
  MelStatus,
} from "@/lib/api/types";

/**
 * /maintenance/mel — cross-fleet MEL items list (M2-G-21).
 *
 * URL-driven state:
 *   ?status=open|closed      (default: open)
 *   ?aircraft=<aircraft-id>  (default: all)
 *
 * Tenant-wide MEL items, joined inline with their aircraft, sorted by
 * the backend (due_at asc — soonest deadlines float to the top). The
 * page wraps the same `MelTable` the per-aircraft view uses; an extra
 * Aircraft column is shown via `showAircraft` so the tail is visible
 * on every row.
 */

const VALID_STATUSES: MelStatus[] = ["open", "closed"];

function parseStatus(raw: string | undefined): MelStatus {
  return VALID_STATUSES.includes(raw as MelStatus)
    ? (raw as MelStatus)
    : "open";
}

export default async function MelListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; aircraft?: string }>;
}) {
  const { status: statusParam, aircraft: aircraftParam } =
    await searchParams;
  const status = parseStatus(statusParam);
  const aircraftId = aircraftParam ?? null;

  let items: MelItemResponse[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const [melResult, aircraftResult] = await Promise.all([
      listMelItems({
        status,
        aircraftId: aircraftId ?? undefined,
        limit: 200,
      }),
      listAircraft(),
    ]);
    items = melResult.items;
    aircraft = aircraftResult.items;
  } catch (err) {
    const code = err instanceof ApiError ? err.status : 0;
    loadError =
      code === 401
        ? "Your session expired — please sign in again."
        : "MEL feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          MEL Items
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Deferred-maintenance backlog across the fleet. Sorted by due
          date — soonest first.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusFilterTabs<MelStatus>
          basePath="/maintenance/mel"
          options={[
            { value: "open", label: "Open" },
            { value: "closed", label: "Closed" },
          ]}
          activeStatus={status}
          aircraftId={aircraftId ?? undefined}
        />
        <AircraftFilter
          basePath="/maintenance/mel"
          aircraft={aircraft}
          activeAircraftId={aircraftId}
          activeStatus={status}
        />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : (
        <MelTable
          items={items}
          showAircraft
          emptyMessage={
            status === "closed"
              ? "No closed MEL items match this filter."
              : "No open MEL items match this filter."
          }
        />
      )}
    </div>
  );
}

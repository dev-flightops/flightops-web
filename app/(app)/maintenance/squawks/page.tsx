import { AircraftFilter } from "@/components/maintenance/aircraft-filter";
import { SquawksTable } from "@/components/maintenance/squawks-table";
import { StatusFilterTabs } from "@/components/maintenance/status-filter-tabs";
import { ApiError } from "@/lib/api/client";
import { listSquawks } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import type {
  AircraftListItem,
  SquawkResponse,
  SquawkStatus,
} from "@/lib/api/types";

/**
 * /maintenance/squawks — cross-fleet squawks list (M2-G-21).
 *
 * URL-driven state:
 *   ?status=open|in_progress|resolved (default: "active" = open ∪ in_progress)
 *   ?aircraft=<aircraft-id>           (default: all)
 *
 * The backend doesn't accept multi-status yet on /squawks (only
 * single-value or unfiltered). For the default "Active" tab we issue
 * two parallel calls (open + in_progress) and merge — same pattern
 * as the aircraft detail page in M2-G-20. Single-status tabs (Open /
 * In progress / Resolved) hit a single backend call.
 *
 * If multi-status becomes hot, the squawks list_squawks endpoint can
 * be upgraded to accept a list (one-line change matching the pattern
 * already used by ops/flights in M2-M-15).
 */

type SquawksTab = "active" | SquawkStatus;
const VALID_TABS: SquawksTab[] = [
  "active",
  "open",
  "in_progress",
  "resolved",
];

function parseTab(raw: string | undefined): SquawksTab {
  return VALID_TABS.includes(raw as SquawksTab)
    ? (raw as SquawksTab)
    : "active";
}

export default async function SquawksListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; aircraft?: string }>;
}) {
  const { status: statusParam, aircraft: aircraftParam } =
    await searchParams;
  const tab = parseTab(statusParam);
  const aircraftId = aircraftParam ?? null;

  let items: SquawkResponse[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;

  try {
    const fetches = await Promise.all([
      fetchSquawks(tab, aircraftId),
      listAircraft(),
    ]);
    items = fetches[0];
    aircraft = fetches[1].items;
  } catch (err) {
    const code = err instanceof ApiError ? err.status : 0;
    loadError =
      code === 401
        ? "Your session expired — please sign in again."
        : "Squawks feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Squawks
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Pilot- and mechanic-reported discrepancies across the fleet.
          Most recent first.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <StatusFilterTabs<SquawksTab>
          basePath="/maintenance/squawks"
          options={[
            { value: "active", label: "Active" },
            { value: "open", label: "Open" },
            { value: "in_progress", label: "In progress" },
            { value: "resolved", label: "Resolved" },
          ]}
          activeStatus={tab}
          aircraftId={aircraftId ?? undefined}
        />
        <AircraftFilter
          basePath="/maintenance/squawks"
          aircraft={aircraft}
          activeAircraftId={aircraftId}
          activeStatus={tab}
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
        <SquawksTable
          items={items}
          showAircraft
          emptyMessage={`No ${
            tab === "active"
              ? "active"
              : tab === "in_progress"
                ? "in-progress"
                : tab
          } squawks match this filter.`}
        />
      )}
    </div>
  );
}

async function fetchSquawks(
  tab: SquawksTab,
  aircraftId: string | null,
): Promise<SquawkResponse[]> {
  const opts = {
    aircraftId: aircraftId ?? undefined,
    limit: 200,
  };
  if (tab === "active") {
    // Two parallel single-status calls then merge — backend doesn't
    // accept multi-status yet (cf. M2-M-15 for ops/flights).
    const [openRes, inProgressRes] = await Promise.all([
      listSquawks({ ...opts, status: "open" }),
      listSquawks({ ...opts, status: "in_progress" }),
    ]);
    return [...openRes.items, ...inProgressRes.items].sort(
      (a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at),
    );
  }
  return (await listSquawks({ ...opts, status: tab })).items;
}

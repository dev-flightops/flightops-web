import { AircraftFilter } from "@/components/maintenance/aircraft-filter";
import { SquawksTable } from "@/components/maintenance/squawks-table";
import { StatusFilterTabs } from "@/components/maintenance/status-filter-tabs";
import { ApiError } from "@/lib/api/client";
import { listSquawks, listWorkOrders } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import type {
  AircraftListItem,
  SquawkResponse,
  SquawkStatus,
} from "@/lib/api/types";
import { auth } from "@/auth";
import { AIRWORTHINESS_WRITERS, WORK_ORDER_WRITERS, hasAnyRole } from "@/lib/roles";

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
  // Resolving is maintenance's (AIRWORTHINESS_WRITERS, enforced by the
  // backend); everyone else sees the list read-only.
  const session = await auth();
  const roles = session?.roles ?? [];
  const canResolve = hasAnyRole(roles, AIRWORTHINESS_WRITERS);
  const canOpenWorkOrder = hasAnyRole(roles, WORK_ORDER_WRITERS);
  const tab = parseTab(statusParam);
  const aircraftId = aircraftParam ?? null;

  let items: SquawkResponse[] = [];
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;
  // The work order opened for each squawk (#134). Best-effort: without
  // them the list still works, it just offers to open one.
  const workOrders: Record<string, { id: string; wo_number: string }> = {};

  try {
    const fetches = await Promise.all([
      fetchSquawks(tab, aircraftId),
      listAircraft(),
      listWorkOrders().catch(() => ({ items: [], total: 0 })),
    ]);
    items = fetches[0];
    aircraft = fetches[1].items;
    for (const wo of fetches[2].items) {
      if (wo.squawk_id) workOrders[wo.squawk_id] = { id: wo.id, wo_number: wo.wo_number };
    }
  } catch (err) {
    const code = err instanceof ApiError ? err.status : 0;
    loadError =
      code === 401
        ? "Your session expired — please sign in again."
        : "Squawks feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">
          Squawks
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
          canResolve={canResolve}
          signerName={session?.user?.name?.trim() ?? ""}
          workOrders={workOrders}
          canOpenWorkOrder={canOpenWorkOrder}
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

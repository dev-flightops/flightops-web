import { auth } from "@/auth";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
import { AddDueItemDialog } from "@/components/maintenance/due-item-dialogs";
import { DueListTable } from "@/components/maintenance/due-list-table";
import { ApiError } from "@/lib/api/client";
import {
  getFleetAirworthiness,
  listDueList,
  type DueItem,
  type DueState,
} from "@/lib/api/maintenance";
import { formatZuluDate } from "@/lib/format/flight-time";
import { AIRWORTHINESS_WRITERS, hasAnyRole } from "@/lib/roles";

/**
 * /maintenance/due-list — every aircraft's inspections, ADs, bulletins,
 * life-limited components and calendar items, most urgent first (#156).
 *
 * The client, 10/29: "Overdue inspections don't ground aircraft. N100PA's
 * 100-hour inspection (due Aug 20), N503PA's ELT battery (due Aug 17) and
 * N200PA's Phase 2 (due Aug 23) are all past due, yet those aircraft show
 * 'All items current / Airworthy' and keep flying." Legacy's due list was
 * never ported; this is it. An overdue item that grounds keeps the
 * aircraft from release, and the fleet card says so.
 */

const FILTERS: { value: DueState | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due soon" },
  { value: "current", label: "Current" },
];

function parseState(v: string | string[] | undefined): DueState | "" {
  const s = Array.isArray(v) ? v[0] : v;
  return s === "overdue" || s === "due_soon" || s === "current" || s === "not_scheduled" ? s : "";
}

export const dynamic = "force-dynamic";

export default async function DueListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseState((await searchParams).state);
  const canSignOff = hasAnyRole((await auth())?.roles ?? [], AIRWORTHINESS_WRITERS);

  let items: DueItem[] = [];
  let asOf: string | null = null;
  let fleet: { id: string; tail_number: string }[] = [];
  let loadError: string | null = null;
  try {
    const [list, airworthiness] = await Promise.all([
      listDueList(state ? { state } : {}),
      canSignOff ? getFleetAirworthiness().catch(() => null) : Promise.resolve(null),
    ]);
    items = list.items;
    asOf = list.as_of;
    fleet = (airworthiness?.items ?? [])
      .filter((a) => a.is_active || a.grounded_at)
      .map((a) => ({ id: a.aircraft.id, tail_number: a.aircraft.tail_number }));
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The due list is unavailable. Try refreshing in a moment.";
  }

  const overdue = items.filter((i) => i.state === "overdue").length;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Due List"
        back={{ href: "/maintenance", label: "Fleet" }}
        description={
          asOf
            ? `Inspections, ADs, bulletins, components and calendar items across the fleet, as of ${formatZuluDate(asOf)}. An overdue item that grounds keeps its aircraft from release.`
            : "Inspections, ADs, bulletins, components and calendar items across the fleet."
        }
        actions={canSignOff && fleet.length > 0 ? <AddDueItemDialog aircraft={fleet} /> : null}
      />

      <SegmentLinks
        label="Status"
        className="mb-4"
        items={FILTERS.map((f) => ({
          href: f.value ? `/maintenance/due-list?state=${f.value}` : "/maintenance/due-list",
          label: f.label,
          active: f.value === state,
        }))}
      />

      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : (
        <>
          {overdue > 0 && !state ? (
            <Notice tone="red" label="Overdue" className="mb-4">
              {overdue} item{overdue === 1 ? " is" : "s are"} past due.
            </Notice>
          ) : null}
          <DueListTable
            items={items}
            showAircraft
            canSignOff={canSignOff}
            emptyMessage={
              state
                ? "Nothing in this state."
                : "Nothing on the due list yet. Maintenance adds each aircraft's inspections, ADs and calendar items here."
            }
          />
        </>
      )}
    </div>
  );
}

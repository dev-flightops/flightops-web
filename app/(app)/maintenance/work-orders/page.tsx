import Link from "next/link";

/**
 * /maintenance/work-orders — legacy `templates/maintenance/work_orders.html`.
 *
 * Table view with status filter chips (Active default + all wo_statuses),
 * columns WO # · Aircraft · Title · Type · Priority · Status · Opened
 * · Due. Priority badges: AOG red / High yellow / Normal gray. Status
 * badges: Open blue / In Progress blue / Awaiting Parts yellow /
 * Completed green / Closed gray.
 *
 * Backend not shipped — Marc's M2 maintenance-service Work Orders CRUD
 * + state machine story owns the data. Rendering the full column set +
 * status chips so the layout is complete for the empty state; swap to
 * live data (`listWorkOrders({ status })`) once the endpoint lands.
 */

const WO_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting_parts", label: "Awaiting Parts" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
] as const;

type StatusFilter = "" | (typeof WO_STATUSES)[number]["value"];

function parseStatus(v: string | string[] | undefined): StatusFilter {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "open" || s === "in_progress" || s === "awaiting_parts" || s === "completed" || s === "closed") {
    return s;
  }
  return "";
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filterStatus = parseStatus(params.status);
  const total: number = 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Work Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total} order{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/maintenance"
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
          >
            Fleet
          </Link>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Work Orders ship with the maintenance-service (M2 backend)"
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            + New Work Order
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/maintenance/work-orders"
          className={
            "rounded px-3 py-1.5 text-xs font-semibold " +
            (!filterStatus
              ? "bg-status-blue text-white"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Active
        </Link>
        {WO_STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/maintenance/work-orders?status=${s.value}`}
            className={
              "rounded px-3 py-1.5 text-xs font-semibold " +
              (filterStatus === s.value
                ? "bg-status-blue text-white"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">WO #</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Title</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Priority</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Opened</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Due</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  {filterStatus
                    ? `No work orders with status "${WO_STATUSES.find((s) => s.value === filterStatus)?.label}".`
                    : "No work orders yet. Open one from a squawk on /maintenance/squawks, or create a new work order to get started."}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

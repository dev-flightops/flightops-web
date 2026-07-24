import Link from "next/link";

import { listWorkOrders } from "@/lib/api/maintenance";
import type { WorkOrderRow, WorkOrderStatus } from "@/lib/api/maintenance";
import { ApiError } from "@/lib/api/client";

/**
 * /maintenance/work-orders — legacy `templates/maintenance/work_orders.html`.
 *
 * Reads live from `/maintenance/work-orders` (M2 backend tail, PR
 * flightops-services PR #113). Filter by status via `?status=`
 * query param. Legacy default is Active (all statuses); named
 * statuses filter to that single value.
 *
 * "New Work Order" modal is a follow-up story — the backend POST
 * endpoint exists.
 */

const BACKEND_HINT_ADD =
  "New Work Order modal is a follow-up — POST endpoint is live";

const WO_STATUSES: readonly {
  value: WorkOrderStatus;
  label: string;
}[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "awaiting_parts", label: "Awaiting Parts" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
];

type StatusParam = WorkOrderStatus | "";

function parseStatus(v: string | string[] | undefined): StatusParam {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "open" ||
    s === "in_progress" ||
    s === "awaiting_parts" ||
    s === "completed" ||
    s === "closed"
  ) {
    return s;
  }
  return "";
}

export const dynamic = "force-dynamic";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filterStatus = parseStatus(params.status);

  let orders: WorkOrderRow[] = [];
  let loadError: string | null = null;
  try {
    const response = await listWorkOrders(
      filterStatus ? { status: filterStatus } : {},
    );
    orders = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Work orders unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Work Orders</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}
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
            title={BACKEND_HINT_ADD}
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

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
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
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                      {filterStatus
                        ? `No work orders with status "${WO_STATUSES.find((s) => s.value === filterStatus)?.label}".`
                        : "No work orders yet. Open one from a squawk on /maintenance/squawks, or create a new work order to get started."}
                    </td>
                  </tr>
                ) : (
                  orders.map((wo) => (
                    <tr key={wo.id} className="hover:bg-muted/5">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-status-blue">
                        {wo.wo_number}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {wo.aircraft_tail ?? "?"}
                      </td>
                      <td className="px-4 py-3 text-xs">{wo.title}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                          {wo.wo_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <PriorityBadge priority={wo.priority} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {wo.opened_date}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {wo.due_date ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "aog") {
    return (
      <span className="rounded border border-status-red/40 bg-status-red/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-red">
        AOG
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span className="rounded border border-status-yellow/40 bg-status-yellow/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-yellow">
        High
      </span>
    );
  }
  return (
    <span className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
      Normal
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "border-status-green/40 bg-status-green/10 text-status-green"
      : status === "in_progress"
        ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
        : status === "awaiting_parts"
          ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
          : status === "closed"
            ? "border-border bg-muted/30 text-muted-foreground"
            : "border-status-blue/40 bg-status-blue/10 text-status-blue";
  const label =
    status === "in_progress"
      ? "In Progress"
      : status === "awaiting_parts"
        ? "Awaiting Parts"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

import Link from "next/link";

import { auth } from "@/auth";
import { listWorkOrders } from "@/lib/api/maintenance";
import { WORK_ORDER_WRITERS, hasAnyRole } from "@/lib/roles";
import type { WorkOrderRow, WorkOrderStatus } from "@/lib/api/maintenance";
import { ApiError } from "@/lib/api/client";

/**
 * /maintenance/work-orders — legacy `templates/maintenance/work_orders.html`.
 *
 * Reads live from `/maintenance/work-orders` (M2 backend tail, PR
 * flightops-services PR #113). Filter by status via `?status=`
 * query param. Default is All (all statuses); named
 * statuses filter to that single value.
 *
 * New Work Order opens /maintenance/work-orders/new, and each work order
 * its own page with its timeline and next steps (#134).
 */

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
  const canWrite = hasAnyRole((await auth())?.roles ?? [], WORK_ORDER_WRITERS);

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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Work Orders</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/maintenance"
            className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Fleet
          </Link>
          {canWrite && (
            <Link
              href="/maintenance/work-orders/new"
              className="btn-caps rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark text-[0.72rem]"
            >
              + New Work Order
            </Link>
          )}
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/maintenance/work-orders"
          className={
            "rounded px-3 py-1.5 text-xs font-semibold " +
            (!filterStatus
              ? "bg-primary text-white"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          All
        </Link>
        {WO_STATUSES.map((s) => (
          <Link
            key={s.value}
            href={`/maintenance/work-orders?status=${s.value}`}
            className={
              "rounded px-3 py-1.5 text-xs font-semibold " +
              (filterStatus === s.value
                ? "bg-primary text-white"
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
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ff-thead">
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
                    <tr
                      key={wo.id}
                      className={
                        wo.is_overdue
                          ? "shadow-[inset_3px_0_0_rgb(var(--status-red))] hover:bg-accent"
                          : "hover:bg-accent"
                      }
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-foreground">
                        <Link href={`/maintenance/work-orders/${wo.id}`} className="text-primary hover:underline">
                          {wo.wo_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                        {wo.aircraft_tail ?? "?"}
                      </td>
                      <td className="px-4 py-3 text-xs">{wo.title}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="eyebrow">
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
                        {/* #156: "Work orders past due aren't flagged overdue." */}
                        {wo.is_overdue ? (
                          <div className="mt-0.5 font-sans">
                            <span className="status-mark text-status-red">Overdue</span>
                          </div>
                        ) : null}
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
      <span className="status-mark text-status-red">
        AOG
      </span>
    );
  }
  if (priority === "high") {
    return (
      <span className="status-mark text-status-yellow">
        High
      </span>
    );
  }
  return (
    <span className="eyebrow">
      Normal
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "text-status-green"
      : status === "in_progress"
        ? "text-status-blue"
        : status === "awaiting_parts"
          ? "text-status-yellow"
          : status === "closed"
            ? "text-muted-foreground"
            : "text-status-blue";
  const label =
    status === "in_progress"
      ? "In Progress"
      : status === "awaiting_parts"
        ? "Awaiting Parts"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={
        "status-mark text-[0.65rem] " +
        cls
      }
    >
      {label}
    </span>
  );
}

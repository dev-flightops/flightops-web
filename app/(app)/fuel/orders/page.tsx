import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { ApiError } from "@/lib/api/client";
import { listFuelOrders } from "@/lib/api/ground";
import { formatZuluDate } from "@/lib/format/flight-time";
import type {
  FuelOrderResponse,
  FuelOrderStatus,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { OrdersStatusFilter } from "./status-filter";

/**
 * /fuel/orders — Fuel orders list (M2-G-40).
 *
 * Reads `/ground/fuel/orders` (M2-M-27b). Status filter is URL-driven
 * so dispatchers can deep-link. Each row links to the per-order detail
 * page where the confirm / fueled / cancel actions live.
 */

const ALLOWED_STATUSES: ReadonlySet<FuelOrderStatus> = new Set([
  "ordered",
  "confirmed",
  "fueled",
  "discrepancy",
  "cancelled",
]);

function parseStatus(raw: string | undefined): FuelOrderStatus | undefined {
  if (!raw) return undefined;
  const lc = raw.toLowerCase() as FuelOrderStatus;
  return ALLOWED_STATUSES.has(lc) ? lc : undefined;
}

export default async function FuelOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = parseStatus(statusParam);

  let orders: FuelOrderResponse[] = [];
  let loadError: string | null = null;

  try {
    orders = (await listFuelOrders({ status, limit: 200 })).items;
  } catch (err) {
    const apiStatus = err instanceof ApiError ? err.status : 0;
    loadError =
      apiStatus === 401
        ? "Your session expired — please sign in again."
        : "Fuel orders unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link
            href="/fuel"
            className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-2")}
          >
            <span aria-hidden>‹</span> Fuel
          </Link>
          <h1 className="page-title">Fuel Orders</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}
            {status ? ` · status ${status}` : ""}
          </p>
        </div>
        <Link
          href="/fuel/orders/new"
          className="btn-caps rounded-md border border-primary/40 bg-background px-3 py-1.5 text-primary hover:bg-primary/5 text-[0.72rem]"
        >
          + Order Fuel
        </Link>
      </header>

      <OrdersStatusFilter active={status} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No fuel orders {status ? `with status ${status}` : "yet"}.
          </p>
          {!status && (
            <Link
              href="/fuel/orders/new"
              className="btn-caps mt-4 inline-block rounded-md border border-primary/40 bg-background px-3 py-1.5 text-primary hover:bg-primary/5 text-[0.72rem]"
            >
              + Order Fuel
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="ff-thead">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Aircraft</th>
                <th className="px-4 py-3">Base</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Fuel</th>
                <th className="px-4 py-3 text-right">Requested</th>
                <th className="px-4 py-3 text-right">Actual</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <OrderRow key={o.id} order={o} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: FuelOrderResponse }) {
  return (
    <tr className="border-b border-border last:border-0">
      {/* #156: "Fuel orders: no date column". The day it's wanted. */}
      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground">
        {formatZuluDate(order.requested_fuel_date)}
      </td>
      <td className="px-4 py-3 font-mono font-semibold text-foreground">
        {order.n_number}
      </td>
      <td className="px-4 py-3 font-mono text-foreground">{order.base_code}</td>
      <td className="px-4 py-3 text-foreground">
        {order.supplier_name_snapshot}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {order.fuel_type_label_snapshot}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
        {order.requested_quantity_gallons.toLocaleString()} gal
        <BelowPlan order={order} />
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {order.actual_quantity_gallons !== null ? (
          <span className="text-status-green">
            {order.actual_quantity_gallons.toLocaleString()} gal
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusChip status={order.status} />
      </td>
      <td className="px-4 py-3 text-right">
        <Link
          href={`/fuel/orders/${order.id}`}
          className={linkCaps}
        >
          View <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
  );
}

/**
 * #156: "manifest plans 169 gal Jet A for PGR701 (round trip + reserve);
 * scenario fuel orders are 90 gal every day; nothing flags the
 * shortfall." An order is the uplift, so less than the plan can be right
 * when the rest is in the tanks: flagged for someone to check, not
 * refused.
 */
function BelowPlan({ order }: { order: FuelOrderResponse }) {
  const planned = order.planned_fuel_gallons;
  if (planned === null || planned === undefined || order.requested_quantity_gallons >= planned) return null;
  return (
    <div className="mt-0.5 font-sans text-[0.65rem] font-semibold text-status-yellow">
      Plan {planned.toLocaleString()} gal: check what&apos;s aboard
    </div>
  );
}

function StatusChip({ status }: { status: FuelOrderStatus }) {
  const map: Record<FuelOrderStatus, string> = {
    ordered: "text-status-blue",
    confirmed: "text-status-blue",
    fueled: "text-status-green",
    discrepancy:
      "text-status-yellow",
    cancelled: "text-muted-foreground",
  };
  return (
    <span
      className={`status-mark ${map[status]}`}
    >
      {status}
    </span>
  );
}

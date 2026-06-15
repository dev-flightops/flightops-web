import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listFuelOrders } from "@/lib/api/ground";
import type {
  FuelOrderResponse,
  FuelOrderStatus,
} from "@/lib/api/types";

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/fuel"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Fuel
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Fuel Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {orders.length} order{orders.length === 1 ? "" : "s"}
            {status ? ` · status ${status}` : ""}
          </p>
        </div>
        <Link
          href="/fuel/orders/new"
          className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
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
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No fuel orders {status ? `with status ${status}` : "yet"}.
          </p>
          {!status && (
            <Link
              href="/fuel/orders/new"
              className="mt-4 inline-block rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
            >
              + Order Fuel
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
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
          className="text-sm font-medium text-status-blue hover:underline"
        >
          View →
        </Link>
      </td>
    </tr>
  );
}

function StatusChip({ status }: { status: FuelOrderStatus }) {
  const map: Record<FuelOrderStatus, string> = {
    ordered: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    confirmed: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    fueled: "border-status-green/40 bg-status-green/10 text-status-green",
    discrepancy:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    cancelled: "border-border bg-card/60 text-muted-foreground",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${map[status]}`}
    >
      {status}
    </span>
  );
}

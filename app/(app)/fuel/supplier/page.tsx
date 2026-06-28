import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listSupplierFuelOrders } from "@/lib/api/ground";
import type { FuelOrderResponse, FuelOrderStatus } from "@/lib/api/types";

import { AcknowledgeButton } from "./acknowledge-button";
import { SupplierStatusFilter } from "./status-filter";

/**
 * /fuel/supplier — Spec for M2-G-12 fuel supplier portal.
 *
 * Inbox for fuel suppliers (User rows with a non-null
 * `fuel_supplier_id`). Lists incoming orders for the caller's
 * supplier and lets them acknowledge (`ordered → confirmed`) from
 * the row.
 *
 * Non-supplier users hitting this URL see a 403 → friendly
 * "you're not a supplier" notice rather than a backend error.
 *
 * Deferred (follow-up PRs):
 *   - Per-order detail page with the full status timeline
 *   - Supplier-side fueled / discrepancy reporting (today only
 *     acknowledge is exposed; ramp staff still close the order)
 *   - Supplier-side price updates against FuelSupplierBase
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

export default async function SupplierPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = parseStatus(statusParam);

  let orders: FuelOrderResponse[] = [];
  let loadError: string | null = null;
  let notAuthorized = false;

  try {
    orders = (
      await listSupplierFuelOrders({ status, limit: 200 })
    ).items;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        notAuthorized = true;
      } else if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else {
        loadError =
          "Supplier inbox unavailable. Try refreshing in a moment.";
      }
    } else {
      loadError = "Supplier inbox unavailable. Try refreshing in a moment.";
    }
  }

  if (notAuthorized) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-6 py-8 text-center">
          <h1 className="text-base font-bold tracking-tight text-status-yellow">
            Supplier Portal
          </h1>
          <p className="mt-2 text-sm text-foreground">
            This area is for fuel-supplier accounts only.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you're a supplier rep and you're seeing this in error, ask
            your operations contact to bind your account to your supplier
            directory entry.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Supplier Portal — Fuel Orders
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Acknowledge new orders so the requesting dispatcher knows you
          have it. Fueled / closeout is handled by ramp staff after
          delivery.
        </p>
      </header>

      <SupplierStatusFilter active={status ?? null} />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
          {status
            ? `No orders in ${status} status.`
            : "No orders in your inbox right now."}
        </div>
      ) : (
        <SupplierOrderTable orders={orders} />
      )}
    </div>
  );
}

function SupplierOrderTable({ orders }: { orders: FuelOrderResponse[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Requested</th>
            <th className="px-3 py-2 text-left">Tail</th>
            <th className="px-3 py-2 text-left">Base</th>
            <th className="px-3 py-2 text-left">Fuel</th>
            <th className="px-3 py-2 text-right">Gallons</th>
            <th className="px-3 py-2 text-left">For Date</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Requested By</th>
            <th className="px-3 py-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o, idx) => (
            <tr
              key={o.id}
              className={
                idx % 2 === 0
                  ? "border-t border-border/60"
                  : "border-t border-border/60 bg-card/40"
              }
            >
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {o.requested_at.slice(0, 10)}
              </td>
              <td className="px-3 py-2 font-mono font-semibold text-foreground">
                {o.n_number}
              </td>
              <td className="px-3 py-2 font-mono text-foreground">
                {o.base_code}
              </td>
              <td className="px-3 py-2 text-foreground">
                {o.fuel_type_label_snapshot}
              </td>
              <td className="px-3 py-2 text-right font-mono tabular-nums text-foreground">
                {o.requested_quantity_gallons}
              </td>
              <td className="px-3 py-2 font-mono text-foreground">
                {o.requested_fuel_date}
              </td>
              <td className="px-3 py-2">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-3 py-2 text-foreground">
                {o.requested_by.full_name}
              </td>
              <td className="px-3 py-2">
                {o.status === "ordered" ? (
                  <AcknowledgeButton orderId={o.id} tail={o.n_number} />
                ) : (
                  <span className="text-[0.65rem] text-muted-foreground">
                    —
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border/40 px-3 py-2 text-[0.65rem] text-muted-foreground">
        Need to close out a fueled order? Ramp staff handles that on the{" "}
        <Link
          href="/fuel/orders"
          className="font-semibold text-status-blue hover:underline"
        >
          dispatcher view
        </Link>
        .
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: FuelOrderStatus }) {
  const tone =
    status === "ordered"
      ? "bg-status-yellow/15 text-status-yellow"
      : status === "confirmed"
        ? "bg-status-blue/15 text-status-blue"
        : status === "fueled"
          ? "bg-status-green/15 text-status-green"
          : status === "discrepancy"
            ? "bg-status-red/15 text-status-red"
            : "bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${tone}`}
    >
      {status}
    </span>
  );
}

import { redirect } from "next/navigation";

import { supplierListOrders } from "@/lib/api/supplier-ground";
import { getSupplierSession } from "@/lib/api/supplier-session";
import type {
  FuelOrderListResponse,
  FuelOrderResponse,
} from "@/lib/api/types";

import { SupplierLogoutButton } from "./logout-button";

/**
 * M3-X-2 — Fuel Supplier Portal inbox.
 *
 * Server-rendered list of orders across every (tenant, supplier)
 * pair the account is bound to. Each row surfaces:
 *   - Tenant chip (which operator placed the order)
 *   - Aircraft tail + base
 *   - Requested date + gallons (with L/R split when populated)
 *   - Status + supplier name
 *
 * Empty-binding accounts get a friendly "no active tenants" state
 * instead of the table.
 *
 * Interactive acknowledge / mark-fueled controls land in a follow-up
 * PR — this page proves the auth + cross-tenant query end-to-end.
 */
export default async function SupplierInboxPage() {
  const session = await getSupplierSession();
  if (!session) redirect("/fuel-supplier/login");

  let ordersResp: FuelOrderListResponse | null = null;
  let loadError: string | null = null;
  try {
    ordersResp = await supplierListOrders({ limit: 100 });
  } catch (err) {
    loadError =
      err instanceof Error
        ? `Couldn't load orders — ${err.message}`
        : "Couldn't load orders.";
  }

  const orders = ordersResp?.items ?? [];
  const bindingCount = session.bindings.length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Fuel Supplier Portal
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-semibold text-foreground">
              {session.full_name}
            </span>{" "}
            ({session.email}) — {bindingCount} operator
            {bindingCount === 1 ? "" : "s"} contracted
          </p>
        </div>
        <SupplierLogoutButton />
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {loadError}
        </div>
      ) : bindingCount === 0 ? (
        <EmptyBindingsPanel />
      ) : orders.length === 0 ? (
        <EmptyInboxPanel />
      ) : (
        <OrdersTable orders={orders} tenantLabels={buildTenantLabels(orders)} />
      )}
    </div>
  );
}

function EmptyBindingsPanel() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-5 py-10 text-center">
      <h2 className="text-sm font-semibold text-foreground">
        No active tenants
      </h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Your account isn't currently contracted to any operator. Reach
        out to the operator's dispatch team to have them bind your
        supplier login to their tenant.
      </p>
    </div>
  );
}

function EmptyInboxPanel() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-5 py-10 text-center">
      <h2 className="text-sm font-semibold text-foreground">Inbox clear</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        No fuel orders waiting for you right now. New orders appear
        here as operators dispatch them.
      </p>
    </div>
  );
}

/**
 * Builds a per-tenant chip label from the orders returned. We don't
 * have a `/tenants` endpoint on the supplier surface, so we key by
 * `supplier_name_snapshot` (which mirrors the tenant's supplier
 * name-of-record) as a proxy — same supplier name across two tenants
 * would collide, but in practice a supplier account bound to two
 * tenants sees two distinct FuelSupplier rows with distinct names
 * ("AvFuel — Kenai Ops" vs "AvFuel — Anchorage Ops").
 */
function buildTenantLabels(orders: FuelOrderResponse[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const o of orders) {
    map.set(o.supplier.id, o.supplier_name_snapshot);
  }
  return map;
}

function OrdersTable({
  orders,
  tenantLabels,
}: {
  orders: FuelOrderResponse[];
  tenantLabels: Map<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Operator / Supplier</th>
            <th className="px-3 py-2 text-left">Aircraft</th>
            <th className="px-3 py-2 text-left">Base</th>
            <th className="px-3 py-2 text-left">Requested</th>
            <th className="px-3 py-2 text-left">Gallons</th>
            <th className="px-3 py-2 text-left">Status</th>
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
              <td className="px-3 py-2">
                <TenantChip label={tenantLabels.get(o.supplier.id) ?? "—"} />
              </td>
              <td className="px-3 py-2 font-mono font-semibold text-foreground">
                {o.n_number}
              </td>
              <td className="px-3 py-2 font-mono text-muted-foreground">
                {o.base_code}
              </td>
              <td className="px-3 py-2 font-mono text-[0.65rem] text-muted-foreground">
                {o.requested_fuel_date}
              </td>
              <td className="px-3 py-2 font-mono text-foreground">
                {o.requested_quantity_gallons.toLocaleString()} gal
                {o.requested_left_gallons !== null &&
                  o.requested_right_gallons !== null && (
                    <span className="ml-1 text-[0.6rem] text-muted-foreground">
                      (L {o.requested_left_gallons} / R{" "}
                      {o.requested_right_gallons})
                    </span>
                  )}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={o.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TenantChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-status-blue/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-status-blue">
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.05em] ${tone}`}
    >
      {status}
    </span>
  );
}

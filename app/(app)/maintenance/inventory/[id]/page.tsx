import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getPart, listPartCategories, listWorkOrders, type PartDetail } from "@/lib/api/maintenance";
import { listAircraft } from "@/lib/api/ops";
import { localDateTime } from "@/lib/format/local-time";
import { TXN_LABEL, dayLabel, formatCost, formatQty } from "@/lib/maintenance/parts";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { MoveStockForm } from "./move-stock-form";

/**
 * /maintenance/inventory/[id] (#172): a part, moving its stock, and its history,
 * legacy's part_history.html. Its shipments (#178), to this base and from it,
 * stand for legacy's Location History: the base is on the row, and each
 * shipment says where stock went and came from.
 */

export const dynamic = "force-dynamic";

const OPEN_ORDERS = ["open", "in_progress", "awaiting_parts"] as const;

const SHIPMENT_STATUS = {
  ordered: "Ordered",
  shipped: "Shipped",
  in_transit: "In transit",
  arrived: "Arrived",
  cancelled: "Cancelled",
} as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="field-label">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const canMove = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);
  let part: PartDetail;
  try {
    part = await getPart(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    throw err;
  }
  const [categories, zones, fleet, orders] = await Promise.all([
    listPartCategories().catch(() => []),
    loadZoneTable().catch(() => null),
    canMove ? listAircraft().catch(() => null) : Promise.resolve(null),
    canMove
      ? Promise.all(OPEN_ORDERS.map((status) => listWorkOrders({ status }).catch(() => null)))
      : Promise.resolve([]),
  ]);
  const zone = zones?.fallback ?? "America/Anchorage";
  const category = categories.find((c) => c.value === part.category)?.label ?? part.category;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title={part.part_number}
        description={part.description}
        back={{ href: "/maintenance/inventory", label: "Inventory" }}
        actions={
          canMove ? (
            <>
              {part.base ? (
                <>
                  <Link href={`/maintenance/shipping?part=${part.id}`} className={buttonOutline}>
                    Ship
                  </Link>
                  <Link href={`/maintenance/parts-requests?part=${part.id}`} className={buttonOutline}>
                    Request
                  </Link>
                </>
              ) : null}
              <Link href={`/maintenance/inventory/${part.id}/edit`} className={buttonOutline}>
                Edit
              </Link>
            </>
          ) : null
        }
      />

      {part.expired ? (
        <Notice tone="red" label="Expired" role="alert" className="mb-4">
          This part expired on {dayLabel(part.expiration_date)}. Do not install it: it can&apos;t be issued.
        </Notice>
      ) : null}
      {part.low_stock ? (
        <Notice tone="yellow" label="Low stock" className="mb-4">
          {formatQty(part.qty_on_hand)} {part.unit} on hand
          {part.incoming > 0 ? `, ${formatQty(part.incoming)} on the way,` : ""} against a minimum of{" "}
          {formatQty(part.qty_minimum)}.
        </Notice>
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Fact label="On hand">
          <span className={cn("font-mono font-semibold", part.low_stock && "text-status-red")}>
            {formatQty(part.qty_on_hand)} {part.unit}
          </span>
        </Fact>
        <Fact label="Minimum">
          <span className="font-mono">{formatQty(part.qty_minimum)}</span>
        </Fact>
        <Fact label="On the way">
          <span className="font-mono">{part.incoming > 0 ? `${formatQty(part.incoming)} ${part.unit}` : "—"}</span>
        </Fact>
        <Fact label="Base">
          <span className="font-mono">{part.base ?? "Not set"}</span>
        </Fact>
        <Fact label="Location">{part.location ?? "—"}</Fact>
        <Fact label="Category">{category}</Fact>
        <Fact label="Unit cost">{formatCost(part.unit_cost)}</Fact>
        <Fact label="Manufacturer">{part.manufacturer ?? "—"}</Fact>
        <Fact label="Batch">
          <span className="font-mono">{part.batch_number ?? "—"}</span>
        </Fact>
        <Fact label="Lot">
          <span className="font-mono">{part.lot_number ?? "—"}</span>
        </Fact>
        <Fact label="Expires">{dayLabel(part.expiration_date)}</Fact>
        <Fact label="Shelf life">{part.shelf_life_months != null ? `${part.shelf_life_months} months` : "—"}</Fact>
        <Fact label="Received">{dayLabel(part.received_date)}</Fact>
        <Fact label="Life limited">{part.is_life_limited ? "Yes" : "No"}</Fact>
        {part.notes ? (
          <div className="col-span-2 sm:col-span-4">
            <dt className="field-label">Notes</dt>
            <dd className="whitespace-pre-wrap text-sm">{part.notes}</dd>
          </div>
        ) : null}
      </dl>

      {canMove ? (
        <section aria-label="Move stock" className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="section-title mb-3">Move stock</h2>
          <MoveStockForm
            partId={part.id}
            unit={part.unit}
            batch={part.batch_number}
            lot={part.lot_number}
            expired={part.expired}
            aircraft={(fleet?.items ?? []).filter((a) => a.is_active)}
            workOrders={orders.flatMap((list) =>
              (list?.items ?? []).map((o) => ({
                id: o.id,
                wo_number: o.wo_number,
                aircraft_id: o.aircraft_id,
                title: o.title,
              })),
            )}
          />
        </section>
      ) : null}

      {part.shipments.length > 0 ? (
        <section aria-label="Shipments" className="mb-6">
          <h2 className="section-title mb-2">Shipments</h2>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>From → To</th>
                  <th className="text-right">Qty</th>
                  <th>AWB</th>
                  <th>Shipped</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {part.shipments.map((s) => (
                  <tr key={s.id}>
                    <td className="whitespace-nowrap font-mono text-xs">
                      {s.kind === "vendor" ? <span className="font-sans">{s.vendor_name ?? "Vendor"}</span> : s.origin_base} →{" "}
                      {s.dest_base}
                    </td>
                    <td className="text-right font-mono">{formatQty(s.quantity)}</td>
                    <td className="font-mono text-xs">{s.airway_bill ?? "—"}</td>
                    <td className="text-xs">{dayLabel(s.shipped_on)}</td>
                    <td className="text-xs">
                      {s.status === "arrived" ? `Arrived ${dayLabel(s.arrived_on)}` : SHIPMENT_STATUS[s.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section aria-label="Transaction log">
        <h2 className="section-title mb-2">Transaction Log</h2>
        {part.transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No movements yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th>Aircraft</th>
                  <th>Work Order</th>
                  <th>Batch / Lot</th>
                  <th>Reference</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {part.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{localDateTime(t.recorded_at, zone)}</td>
                    <td className="text-xs">{TXN_LABEL[t.txn_type]}</td>
                    <td className="text-right font-mono">
                      {t.quantity > 0 ? "+" : ""}
                      {formatQty(t.quantity)}
                    </td>
                    <td className="font-mono text-xs">
                      {t.aircraft_id ? (
                        <Link href={`/maintenance/aircraft/${t.aircraft_id}`} className="text-primary hover:underline">
                          {t.aircraft_tail}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="font-mono text-xs">
                      {t.work_order_id ? (
                        <Link href={`/maintenance/work-orders/${t.work_order_id}`} className="text-primary hover:underline">
                          {t.wo_number}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">
                      {[t.batch_number, t.lot_number].filter(Boolean).join(" / ") || "—"}
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {t.reference ?? "—"}
                      {t.notes ? <span className="block">{t.notes}</span> : null}
                    </td>
                    <td className="text-xs text-muted-foreground">{t.recorded_by ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

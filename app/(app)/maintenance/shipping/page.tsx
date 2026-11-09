import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listPartBases, listParts, type CompanyBaseOption } from "@/lib/api/maintenance";
import { listVendors } from "@/lib/api/mx-vendors";
import { listShipments, type PartShipment, type ShipmentStatus, type ShipmentView } from "@/lib/api/part-logistics";
import { localDay } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";
import { formatQty } from "@/lib/maintenance/parts";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { NewShipmentForm, type StockOption } from "./new-shipment-form";
import { ShipmentActions } from "./shipment-actions";

/**
 * /maintenance/shipping (#178), legacy's templates/maintenance/shipping.html:
 * parts on their way to a base, from another base or a vendor.
 *
 * Stock moves row to row: a shipment between bases takes its quantity off the
 * sending base's row when it's entered and puts it on the receiving base's row
 * when it arrives; on its way it counts toward that row's low stock. Legacy
 * moved the part's one row to the destination, and counted a shipment entered
 * here twice.
 */

export const dynamic = "force-dynamic";

const VIEWS: { view: ShipmentView; label: string }[] = [
  { view: "open", label: "On the way" },
  { view: "arrived", label: "Arrived" },
  { view: "cancelled", label: "Cancelled" },
  { view: "all", label: "All" },
];

const STATUS: Record<ShipmentStatus, { label: string; tone: StatusTone }> = {
  ordered: { label: "Ordered", tone: "gray" },
  shipped: { label: "Shipped", tone: "blue" },
  in_transit: { label: "In transit", tone: "yellow" },
  arrived: { label: "Arrived", tone: "green" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

function isView(value: string | undefined): value is ShipmentView {
  return VIEWS.some((v) => v.view === value);
}

export default async function ShippingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: ShipmentView = isView(rawView) ? rawView : "open";
  const partId = Array.isArray(params.part) ? params.part[0] : params.part;
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);

  let shipments: PartShipment[] | null = null;
  let loadError: string | null = null;
  try {
    shipments = await listShipments(view);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "Shipping is unavailable. Try refreshing in a moment.";
  }
  let stock: StockOption[] = [];
  let bases: CompanyBaseOption[] = [];
  let vendors: { value: string; label: string }[] = [];
  let today = "";
  if (canEdit || shipments) {
    const [parts, baseList, vendorList, zones] = await Promise.allSettled([
      canEdit ? listParts() : Promise.resolve(null),
      canEdit ? listPartBases() : Promise.resolve([]),
      canEdit ? listVendors() : Promise.resolve([]),
      loadZoneTable(),
    ]);
    if (parts.status === "fulfilled" && parts.value) {
      stock = parts.value.items.map((p) => ({
        id: p.id,
        base: p.base,
        label: `${p.part_number} · ${p.description}${p.batch_number ? ` · batch ${p.batch_number}` : ""} · ${p.base ?? "no base"} (${formatQty(p.qty_on_hand)} ${p.unit})`,
      }));
    }
    if (baseList.status === "fulfilled") bases = baseList.value;
    if (vendorList.status === "fulfilled") vendors = vendorList.value.map((v) => ({ value: v.id, label: v.name }));
    today = localDay(zones.status === "fulfilled" ? zones.value.fallback : "America/Anchorage");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Parts Shipping"
        back={{ href: "/maintenance/inventory", label: "Inventory" }}
        description="Parts on their way between bases, and orders coming from vendors."
        actions={
          <Link href="/maintenance/parts-requests" className={buttonOutline}>
            Parts Requests
          </Link>
        }
      />
      {canEdit ? (
        <div className="mb-6">
          <NewShipmentForm stock={stock} bases={bases} vendors={vendors} today={today} defaultPartId={partId} />
        </div>
      ) : null}
      <SegmentLinks
        label="Shipments"
        className="mb-4"
        items={VIEWS.map((v) => ({
          href: v.view === "open" ? "/maintenance/shipping" : `/maintenance/shipping?view=${v.view}`,
          label: v.label,
          active: v.view === view,
        }))}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : shipments && shipments.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Part</th>
                <th>From → To</th>
                <th className="text-right">Qty</th>
                <th>AWB · Carrier</th>
                <th>Shipped</th>
                <th>ETA</th>
                <th>Status</th>
                {canEdit ? (
                  <th>
                    <span className="sr-only">Update</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/maintenance/inventory/${s.dest_part_id ?? s.part_id}`} className="font-mono text-xs font-semibold hover:underline">
                      {s.part_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {s.description}
                      {s.batch_number ? ` · batch ${s.batch_number}` : ""}
                    </span>
                    {s.request_id ? <span className="block text-[0.7rem] text-muted-foreground">For a parts request</span> : null}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {s.kind === "vendor" ? <span className="font-sans">{s.vendor_name ?? "Vendor"}</span> : s.origin_base} → {s.dest_base}
                  </td>
                  <td className="text-right font-mono">
                    {formatQty(s.quantity)} <span className="text-xs text-muted-foreground">{s.unit}</span>
                  </td>
                  <td className="text-xs">
                    {s.airway_bill ? <span className="font-mono">{s.airway_bill}</span> : "—"}
                    {s.carrier ? <span className="block text-muted-foreground">{s.carrier}</span> : null}
                  </td>
                  <td className="whitespace-nowrap text-xs">{s.shipped_on ? formatIsoDay(s.shipped_on) : "—"}</td>
                  <td className="whitespace-nowrap text-xs">
                    {s.arrived_on ? `Arrived ${formatIsoDay(s.arrived_on)}` : s.est_arrival_on ? formatIsoDay(s.est_arrival_on) : "—"}
                  </td>
                  <td>
                    <StatusMark label={STATUS[s.status].label} tone={STATUS[s.status].tone} />
                  </td>
                  {canEdit ? (
                    <td className="text-right">
                      <ShipmentActions shipment={s} today={today} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{view === "open" ? "Nothing on its way." : "No shipments here."}</EmptyState>
      )}
    </div>
  );
}

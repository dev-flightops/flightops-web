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
import {
  listPartRequests,
  type PartRequest,
  type PartRequestPriority,
  type PartRequestStatus,
  type PartRequestView,
} from "@/lib/api/part-logistics";
import { localDateTime } from "@/lib/format/local-time";
import { formatQty } from "@/lib/maintenance/parts";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";

import { NewRequestForm } from "./new-request-form";
import { RequestActions } from "./request-actions";

/**
 * /maintenance/parts-requests (#178), legacy's templates/maintenance/parts_requests.html:
 * one base asking another for a part. AOG first, then urgent.
 *
 * A request names the stock it wants, so the base sending it is the one that
 * holds it. Shipping it enters the shipment (stock leaves the sending row), and
 * the shipment's arrival fulfils the request; legacy's Fulfilled was never set.
 */

export const dynamic = "force-dynamic";

const VIEWS: { view: PartRequestView; label: string }[] = [
  { view: "open", label: "Open" },
  { view: "closed", label: "Closed" },
  { view: "all", label: "All" },
];

const PRIORITY: Record<PartRequestPriority, { label: string; tone: StatusTone }> = {
  aog: { label: "AOG", tone: "red" },
  urgent: { label: "Urgent", tone: "orange" },
  normal: { label: "Normal", tone: "gray" },
};

const STATUS: Record<PartRequestStatus, { label: string; tone: StatusTone }> = {
  pending: { label: "Pending", tone: "yellow" },
  approved: { label: "Approved", tone: "blue" },
  shipped: { label: "Shipped", tone: "teal" },
  fulfilled: { label: "Fulfilled", tone: "green" },
  denied: { label: "Denied", tone: "red" },
  cancelled: { label: "Withdrawn", tone: "muted" },
};

function isView(value: string | undefined): value is PartRequestView {
  return VIEWS.some((v) => v.view === value);
}

export default async function PartsRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view;
  const view: PartRequestView = isView(rawView) ? rawView : "open";
  const partId = Array.isArray(params.part) ? params.part[0] : params.part;
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);

  let requests: PartRequest[] | null = null;
  let loadError: string | null = null;
  const zones = await loadZoneTable().catch(() => null);
  const zone = zones?.fallback ?? "America/Anchorage";
  try {
    requests = await listPartRequests(view);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "Parts requests are unavailable. Try refreshing in a moment.";
  }
  let stock: { id: string; label: string }[] = [];
  let bases: CompanyBaseOption[] = [];
  if (canEdit) {
    const [parts, baseList] = await Promise.allSettled([listParts(), listPartBases()]);
    if (parts.status === "fulfilled") {
      stock = parts.value.items
        .filter((p) => p.base)
        .map((p) => ({
          id: p.id,
          label: `${p.part_number} · ${p.description}${p.batch_number ? ` · batch ${p.batch_number}` : ""} · at ${p.base} (${formatQty(p.qty_on_hand)} ${p.unit})`,
        }));
    }
    if (baseList.status === "fulfilled") bases = baseList.value;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Parts Requests"
        back={{ href: "/maintenance/inventory", label: "Inventory" }}
        description="One base asking another for a part; shipping it enters the shipment."
        actions={
          <Link href="/maintenance/shipping" className={buttonOutline}>
            Shipping
          </Link>
        }
      />
      {canEdit ? (
        <div className="mb-6">
          <NewRequestForm stock={stock} bases={bases} defaultPartId={partId} />
        </div>
      ) : null}
      <SegmentLinks
        label="Requests"
        className="mb-4"
        items={VIEWS.map((v) => ({
          href: v.view === "open" ? "/maintenance/parts-requests" : `/maintenance/parts-requests?view=${v.view}`,
          label: v.label,
          active: v.view === view,
        }))}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : requests && requests.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Priority</th>
                <th>Part</th>
                <th className="text-right">Qty</th>
                <th>From → To</th>
                <th>Asked</th>
                <th>Status</th>
                {canEdit ? (
                  <th>
                    <span className="sr-only">Decide</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} className={r.priority === "aog" && r.status !== "fulfilled" ? "border-l-[3px] border-l-status-red" : undefined}>
                  <td>
                    <StatusMark label={PRIORITY[r.priority].label} tone={PRIORITY[r.priority].tone} />
                  </td>
                  <td>
                    <Link href={`/maintenance/inventory/${r.part_id}`} className="font-mono text-xs font-semibold hover:underline">
                      {r.part_number}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{r.description}</span>
                    {r.notes ? <span className="block text-xs">{r.notes}</span> : null}
                  </td>
                  <td className="text-right font-mono">
                    {formatQty(r.quantity)} <span className="text-xs text-muted-foreground">{r.unit}</span>
                    {r.status === "pending" || r.status === "approved" ? (
                      <span className="block text-[0.7rem] text-muted-foreground">
                        {formatQty(r.on_hand)} on hand at {r.fulfilling_base}
                      </span>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap font-mono text-xs">
                    {r.fulfilling_base} → {r.requesting_base}
                  </td>
                  <td className="text-xs">
                    {r.requested_by_name ?? "—"}
                    <span className="block text-muted-foreground">{localDateTime(r.requested_at, zone)}</span>
                  </td>
                  <td>
                    <StatusMark label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
                    {r.decision_notes ? <span className="mt-0.5 block text-xs text-muted-foreground">{r.decision_notes}</span> : null}
                    {r.airway_bill ? <span className="mt-0.5 block font-mono text-xs text-muted-foreground">AWB {r.airway_bill}</span> : null}
                  </td>
                  {canEdit ? (
                    <td className="text-right">
                      <RequestActions request={r} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{view === "open" ? "No open requests." : "No requests here."}</EmptyState>
      )}
    </div>
  );
}

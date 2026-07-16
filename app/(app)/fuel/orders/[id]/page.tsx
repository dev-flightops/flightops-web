import Link from "next/link";
import { notFound } from "next/navigation";

import { CancelOrderDialog } from "@/components/fuel/cancel-order-dialog";
import { ConfirmOrderDialog } from "@/components/fuel/confirm-order-dialog";
import { MarkFueledDialog } from "@/components/fuel/mark-fueled-dialog";
import { ApiError } from "@/lib/api/client";
import { getFuelOrder, getFuelOrderStatusLog } from "@/lib/api/ground";
import type {
  FuelOrderResponse,
  FuelOrderStatus,
  FuelOrderStatusLogEntry,
} from "@/lib/api/types";

/**
 * /fuel/orders/{id} — order detail (M2-G-40).
 *
 * Reads `/ground/fuel/orders/{id}` + `.../status-log`. Renders a
 * meta block, an actions row (with Confirm / Mark fueled / Cancel
 * shown only when the current status allows the transition), and
 * the immutable audit trail at the bottom.
 */
export default async function FuelOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: FuelOrderResponse | null = null;
  let log: FuelOrderStatusLogEntry[] = [];
  let loadError: string | null = null;

  try {
    const [o, l] = await Promise.all([
      getFuelOrder(id),
      getFuelOrderStatusLog(id).catch(() => null),
    ]);
    order = o;
    log = l?.items ?? [];
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Order unavailable — try refreshing in a moment.";
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <BackLink />
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (order === null) notFound();

  const canConfirm = order.status === "ordered";
  const canMarkFueled = order.status === "confirmed";
  const canCancel =
    order.status === "ordered" || order.status === "confirmed";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <BackLink />
      <Header order={order} />
      <ActionsRow
        orderId={order.id}
        supplierName={order.supplier_name_snapshot}
        requestedGallons={order.requested_quantity_gallons}
        canConfirm={canConfirm}
        canMarkFueled={canMarkFueled}
        canCancel={canCancel}
      />
      <MetaGrid order={order} />
      <StatusLog log={log} />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/fuel/orders"
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      ← Fuel Orders
    </Link>
  );
}

function Header({ order }: { order: FuelOrderResponse }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Fuel order — <span className="font-mono">{order.n_number}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{order.base_code}</span> ·{" "}
          {order.supplier_name_snapshot} · {order.fuel_type_label_snapshot} ·{" "}
          {order.requested_quantity_gallons.toLocaleString()} gal
          {order.requested_left_gallons !== null &&
            order.requested_right_gallons !== null && (
              <span className="ml-1 text-muted-foreground/70">
                (L {order.requested_left_gallons} / R {order.requested_right_gallons})
              </span>
            )}
        </p>
      </div>
      <StatusChip status={order.status} large />
    </div>
  );
}

function ActionsRow({
  orderId,
  supplierName,
  requestedGallons,
  canConfirm,
  canMarkFueled,
  canCancel,
}: {
  orderId: string;
  supplierName: string;
  requestedGallons: number;
  canConfirm: boolean;
  canMarkFueled: boolean;
  canCancel: boolean;
}) {
  if (!canConfirm && !canMarkFueled && !canCancel) {
    return (
      <p className="mb-4 rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        This order is in a terminal state — no further actions.
      </p>
    );
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {canConfirm && (
        <ConfirmOrderDialog
          orderId={orderId}
          supplierName={supplierName}
        />
      )}
      {canMarkFueled && (
        <MarkFueledDialog
          orderId={orderId}
          requestedGallons={requestedGallons}
        />
      )}
      {canCancel && <CancelOrderDialog orderId={orderId} />}
    </div>
  );
}

function MetaGrid({ order }: { order: FuelOrderResponse }) {
  return (
    <div className="mb-6 rounded-lg border border-border bg-card p-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Field
          label="Requested by"
          value={order.requested_by.full_name}
        />
        <Field
          label="Requested at"
          value={formatUtc(order.requested_at)}
          mono
        />
        <Field
          label="Requested date"
          value={order.requested_fuel_date}
          mono
        />
        <Field
          label="Price / gal"
          value={
            order.price_per_gallon !== null
              ? `$${order.price_per_gallon.toFixed(2)}`
              : "—"
          }
        />
        <Field
          label="Confirmed by"
          value={order.confirmed_by_name ?? "—"}
        />
        <Field
          label="Confirmed at"
          value={order.confirmed_at ? formatUtc(order.confirmed_at) : "—"}
          mono
        />
        <Field
          label="Fueled by"
          value={order.fueled_by_name ?? "—"}
        />
        <Field
          label="Fueled at"
          value={order.fueled_at ? formatUtc(order.fueled_at) : "—"}
          mono
        />
        <Field
          label="Actual gallons"
          value={
            order.actual_quantity_gallons !== null
              ? order.actual_left_gallons !== null &&
                order.actual_right_gallons !== null
                ? `${order.actual_quantity_gallons.toLocaleString()} gal (L ${order.actual_left_gallons} / R ${order.actual_right_gallons})`
                : `${order.actual_quantity_gallons.toLocaleString()} gal`
              : "—"
          }
        />
        <Field
          label="Invoice pending"
          value={order.invoice_pending ? "Yes" : "No"}
        />
      </dl>

      {order.special_instructions && (
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Special instructions
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">
            {order.special_instructions}
          </p>
        </div>
      )}

      {order.confirmed_note && (
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Confirmation note
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">
            {order.confirmed_note}
          </p>
        </div>
      )}

      {order.discrepancy_reason && (
        <div className="mt-3 rounded-md border border-status-yellow/40 bg-status-yellow/[0.06] p-3 text-sm">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow">
            Discrepancy
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">
            {order.discrepancy_reason}
          </p>
        </div>
      )}

      {order.cancel_reason && (
        <div className="mt-3 rounded-md border border-status-red/40 bg-status-red/[0.06] p-3 text-sm">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-red">
            Cancelled
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">
            {order.cancel_reason}
          </p>
        </div>
      )}
    </div>
  );
}

function StatusLog({ log }: { log: FuelOrderStatusLogEntry[] }) {
  if (log.length === 0) return null;
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-sm font-semibold text-foreground">
        Audit log ({log.length})
      </h2>
      <ol className="space-y-1 rounded-lg border border-border bg-card p-3 text-xs">
        {log.map((entry) => (
          <li key={entry.id} className="flex flex-wrap gap-2">
            <span className="font-mono text-muted-foreground">
              {formatUtc(entry.created_at)}
            </span>
            <span className="text-muted-foreground">
              {entry.from_status ? `${entry.from_status} → ` : ""}
            </span>
            <StatusChip status={entry.to_status} />
            {entry.actor_name && (
              <span className="text-muted-foreground">
                · by {entry.actor_name}
              </span>
            )}
            {entry.source && (
              <span className="text-muted-foreground">
                · {entry.source}
              </span>
            )}
            {entry.note && (
              <span className="text-foreground/80">— {entry.note}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function StatusChip({
  status,
  large = false,
}: {
  status: FuelOrderStatus;
  large?: boolean;
}) {
  const map: Record<FuelOrderStatus, string> = {
    ordered: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    confirmed: "border-status-blue/40 bg-status-blue/10 text-status-blue",
    fueled: "border-status-green/40 bg-status-green/10 text-status-green",
    discrepancy:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    cancelled: "border-border bg-card/60 text-muted-foreground",
  };
  const size = large ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[0.65rem]";
  return (
    <span
      className={`rounded-md border font-semibold uppercase tracking-[0.06em] ${size} ${map[status]}`}
    >
      {status}
    </span>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
      <dd className={`m-0 mt-0.5 ${mono ? "font-mono" : ""} text-sm`}>{value}</dd>
    </div>
  );
}

function formatUtc(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
}

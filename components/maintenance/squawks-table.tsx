import Link from "next/link";

import { ResolveSquawkDialog } from "@/components/dispatch/packet/resolve-squawk-dialog";
import { SubmitRtsDialog } from "@/components/maintenance/submit-rts-dialog";
import { certLabel } from "@/lib/maintenance/parts";
import { cn } from "@/lib/utils";
import type { SquawkResponse, SquawkSeverity } from "@/lib/api/types";
import { formatBothWithDate } from "@/lib/format/flight-time";

/**
 * Squawks list — used in two contexts:
 *   - Per-aircraft (M2-G-20): aircraft column omitted, scope implied.
 *   - Cross-fleet (M2-G-21): aircraft column shown with click-through
 *     to the aircraft detail page.
 *
 * Severity pill colors match the dispatch maintenance panel:
 *   grounding → red (always dispatch-blocking)
 *   major     → yellow (advisory)
 *   minor     → muted (cosmetic; backend already drops these from the
 *               airworthiness verdict so they only surface in lists)
 *
 * `canResolve` adds Resolve for maintenance (AIRWORTHINESS_WRITERS,
 * 29 Sep): resolving returns the aircraft to service, and the dispatch
 * packet no longer offers it to anyone else.
 *
 * `workOrders` links a squawk to the work order opened for it, and
 * `canOpenWorkOrder` offers to open one (WORK_ORDER_WRITERS, #134).
 *
 * `signerName` is the viewer's name for the sign-off that goes beside Resolve
 * (#172). A squawk waiting for its inspector offers neither: it goes to the queue.
 * A Required Inspection Item sent back by its inspector offers only the sign-off.
 */
export function SquawksTable({
  items,
  showAircraft = false,
  emptyMessage = "No open squawks.",
  canResolve = false,
  workOrders = {},
  canOpenWorkOrder = false,
  signerName = "",
}: {
  items: SquawkResponse[];
  showAircraft?: boolean;
  emptyMessage?: string;
  /** The viewer may resolve squawks (AIRWORTHINESS_WRITERS). */
  canResolve?: boolean;
  /** The work order opened for each squawk, by squawk id. */
  workOrders?: Record<string, { id: string; wo_number: string }>;
  /** The viewer may open a work order (WORK_ORDER_WRITERS). */
  canOpenWorkOrder?: boolean;
  /** The viewer's name, to start a sign-off from. */
  signerName?: string;
}) {
  const actions = canResolve || canOpenWorkOrder || Object.keys(workOrders).length > 0;
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="ff-thead">
          <tr className="text-left eyebrow">
            {showAircraft && <th className="px-3 py-2">Aircraft</th>}
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Reported</th>
            <th className="px-3 py-2">By</th>
            <th className="px-3 py-2">Status</th>
            {actions && (
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((sq) => (
            <SquawkRow
              key={sq.id}
              squawk={sq}
              showAircraft={showAircraft}
              canResolve={canResolve}
              actions={actions}
              workOrder={workOrders[sq.id] ?? null}
              canOpenWorkOrder={canOpenWorkOrder}
              signerName={signerName}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SquawkRow({
  squawk,
  showAircraft,
  canResolve,
  actions,
  workOrder,
  canOpenWorkOrder,
  signerName,
}: {
  squawk: SquawkResponse;
  showAircraft: boolean;
  canResolve: boolean;
  actions: boolean;
  workOrder: { id: string; wo_number: string } | null;
  canOpenWorkOrder: boolean;
  signerName: string;
}) {
  const reported = formatBothWithDate(squawk.reported_at);

  return (
    <tr className="border-t border-border hover:bg-accent">
      {showAircraft && (
        <td className="px-3 py-2.5">
          <Link
            href={`/maintenance/aircraft/${squawk.aircraft.id}`}
            className="font-mono font-semibold text-primary hover:underline"
          >
            {squawk.aircraft.tail_number}
          </Link>
          <div className="text-[0.6rem] text-muted-foreground">
            {squawk.aircraft.model}
          </div>
        </td>
      )}
      <td className="px-3 py-2.5 text-foreground">
        <div>{squawk.title}</div>
        {squawk.description && squawk.description !== squawk.title && (
          <div className="mt-0.5 text-[0.65rem] text-muted-foreground line-clamp-2">
            {squawk.description}
          </div>
        )}
        {squawk.inspection_id ? (
          // Opened by a failed checklist item (#178): back to its inspection.
          <Link
            href={`/maintenance/inspections/${squawk.inspection_id}`}
            className="mt-0.5 inline-block text-[0.65rem] font-semibold text-primary hover:underline"
          >
            From inspection: {squawk.inspection_title}
          </Link>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <SeverityPill severity={squawk.severity} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{reported.local}</div>
        <div className="font-mono text-[0.6rem]">{reported.zulu}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {squawk.reported_by.full_name}
      </td>
      <td className="px-3 py-2.5">
        <StatusChip status={squawk.status} awaitingRii={squawk.awaiting_rii ?? false} />
        {squawk.status === "resolved" && (
          <details className="mt-2 max-w-sm text-xs">
            <summary className="cursor-pointer text-primary">Resolution record</summary>
            <p className="mt-2 whitespace-pre-wrap">
              {squawk.resolution_notes || "Resolution notes not recorded."}
            </p>
            <p className="mt-1 text-muted-foreground">
              Resolved by {squawk.resolved_by?.full_name || "an unrecorded user"}
            </p>
            {squawk.rts_amt_name ? (
              <p className="mt-1 text-muted-foreground">
                Signed off by {squawk.rts_amt_name}, {certLabel(squawk.rts_amt_cert_type)} {squawk.rts_amt_cert_number}
              </p>
            ) : null}
            {squawk.rii_inspector_name ? (
              <p className="mt-1 text-muted-foreground">
                RII inspected by {squawk.rii_inspector_name}, {squawk.rii_inspector_cert_number}
              </p>
            ) : null}
            {squawk.resolved_at && (
              <p className="mt-1 font-mono text-muted-foreground">
                {formatBothWithDate(squawk.resolved_at).local}
                <br />
                {formatBothWithDate(squawk.resolved_at).zulu}
              </p>
            )}
          </details>
        )}
      </td>
      {actions && (
        <td className="px-3 py-2.5 text-right">
          <div className="flex flex-wrap items-center justify-end gap-3">
            {workOrder ? (
              <Link
                href={`/maintenance/work-orders/${workOrder.id}`}
                className="font-mono text-[0.68rem] font-semibold text-primary hover:underline"
              >
                {workOrder.wo_number} <span aria-hidden>›</span>
              </Link>
            ) : (
              canOpenWorkOrder &&
              squawk.status !== "resolved" && (
                <Link
                  href={`/maintenance/work-orders/new?squawk=${squawk.id}`}
                  className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary hover:underline"
                >
                  Open work order<span className="sr-only"> for {squawk.title}</span>
                </Link>
              )
            )}
            {canResolve && squawk.awaiting_rii && (
              <Link
                href="/maintenance/rts"
                className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-primary hover:underline"
              >
                RII sign-off<span className="sr-only"> for {squawk.title}</span> <span aria-hidden>›</span>
              </Link>
            )}
            {canResolve && squawk.status !== "resolved" && !squawk.awaiting_rii && (
              <>
                <SubmitRtsDialog
                  squawkId={squawk.id}
                  aircraftId={squawk.aircraft.id}
                  title={squawk.title}
                  name={signerName}
                  rii={squawk.is_rii ?? false}
                />
                {squawk.is_rii ? null : (
                  <ResolveSquawkDialog
                    squawkId={squawk.id}
                    title={squawk.title}
                    severity={squawk.severity}
                  />
                )}
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

function SeverityPill({ severity }: { severity: SquawkSeverity }) {
  const config: Record<SquawkSeverity, { label: string; className: string }> = {
    grounding: {
      label: "Grounding",
      className: "text-status-red",
    },
    major: {
      label: "Major",
      className: "text-status-yellow",
    },
    minor: {
      label: "Minor",
      className: "text-muted-foreground",
    },
  };
  const c = config[severity];
  return (
    <span
      className={cn(
        "status-mark text-[0.6rem]",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

function StatusChip({
  status,
  awaitingRii,
}: {
  status: SquawkResponse["status"];
  awaitingRii: boolean;
}) {
  const label = awaitingRii
    ? "Awaiting RII"
    : status === "in_progress"
      ? "In progress"
      : status === "open"
        ? "Open"
        : "Resolved";
  return <span className="eyebrow">{label}</span>;
}

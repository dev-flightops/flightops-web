import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  WO_NEXT,
  WO_TYPES,
  getSquawk,
  getWorkOrder,
  type WorkOrderDetail,
  type WorkOrderStatus,
} from "@/lib/api/maintenance";
import type { SquawkResponse } from "@/lib/api/types";
import { localDateTime } from "@/lib/format/local-time";
import { AIRWORTHINESS_WRITERS, WORK_ORDER_WRITERS, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { WorkOrderActions } from "./work-order-actions";

export const dynamic = "force-dynamic";

const WO_STATUS: Record<WorkOrderStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "blue" },
  in_progress: { label: "In progress", tone: "blue" },
  awaiting_parts: { label: "Awaiting parts", tone: "yellow" },
  completed: { label: "Completed", tone: "green" },
  closed: { label: "Closed", tone: "muted" },
};

/**
 * /maintenance/work-orders/[id] (#134): the work order, its squawk, its
 * timeline, and its next steps. Completing or closing it can resolve its
 * open squawk in the same step.
 */
export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail: WorkOrderDetail;
  try {
    detail = await getWorkOrder(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <p role="alert" className="notice notice-yellow">
          {err instanceof ApiError && err.status === 401
            ? "Your session expired — please sign in again."
            : "The work order couldn't be read. Try refreshing in a moment."}
        </p>
      </div>
    );
  }
  const wo = detail.work_order;
  const roles = (await auth())?.roles ?? [];
  const [squawkResult, zones] = await Promise.all([
    wo.squawk_id ? getSquawk(wo.squawk_id).catch(() => null) : Promise.resolve(null),
    loadZoneTable().catch(() => null),
  ]);
  const squawk: SquawkResponse | null = squawkResult;
  const zone = zones?.fallback ?? "America/Anchorage";
  const status = WO_STATUS[wo.status];
  const type = WO_TYPES.find((t) => t.value === wo.wo_type)?.label ?? wo.wo_type;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/maintenance/work-orders" className={cn(linkCaps, "mb-4 text-muted-foreground hover:text-foreground")}>
        <span aria-hidden>‹</span> Work Orders
      </Link>
      <header className="mb-6 border-b border-border pb-5">
        <p className="eyebrow font-mono">{wo.wo_number}</p>
        <h1 className="page-title mt-1">{wo.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusMark label={status.label} tone={status.tone} />
          {wo.priority !== "normal" && (
            <StatusMark label={wo.priority === "aog" ? "AOG" : "High priority"} tone={wo.priority === "aog" ? "red" : "yellow"} />
          )}
          {wo.is_overdue && <StatusMark label="Overdue" tone="red" />}
        </div>
      </header>

      <dl className="mb-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="field-label">Aircraft</dt>
          <dd>
            <Link href={`/maintenance/aircraft/${wo.aircraft_id}`} className="font-mono font-semibold text-primary hover:underline">
              {wo.aircraft_tail ?? "?"}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="field-label">Type</dt>
          <dd>{type}</dd>
        </div>
        <div>
          <dt className="field-label">Opened</dt>
          <dd>
            {wo.opened_date}
            {wo.opened_by_name ? ` by ${wo.opened_by_name}` : ""}
          </dd>
        </div>
        <div>
          <dt className="field-label">Due</dt>
          <dd>{wo.due_date ?? "—"}</dd>
        </div>
        {wo.closed_date && (
          <div>
            <dt className="field-label">Closed</dt>
            <dd>{wo.closed_date}</dd>
          </div>
        )}
      </dl>

      {wo.description && (
        <section className="mb-6">
          <h2 className="section-title mb-2">Description</h2>
          <p className="whitespace-pre-line text-sm">{wo.description}</p>
        </section>
      )}

      {squawk && (
        <section className="mb-6" aria-label="Squawk">
          <h2 className="section-title mb-2">Squawk</h2>
          <p className="text-sm">
            {squawk.title}{" "}
            <span className="text-muted-foreground">
              · {squawk.severity} · reported by {squawk.reported_by.full_name},{" "}
              {localDateTime(squawk.reported_at, zone)}
            </span>
          </p>
          <p className="mt-1">
            {squawk.status === "resolved" ? (
              <>
                <StatusMark label="Resolved" tone="green" />{" "}
                <span className="ml-1 text-xs text-muted-foreground">
                  {squawk.resolved_by ? `by ${squawk.resolved_by.full_name}` : ""}
                  {squawk.resolution_notes ? ` — ${squawk.resolution_notes}` : ""}
                </span>
              </>
            ) : (
              <StatusMark label={squawk.awaiting_rii ? "Awaiting RII" : squawk.status === "in_progress" ? "In progress" : "Open"} tone={squawk.severity === "grounding" ? "red" : "yellow"} />
            )}
          </p>
        </section>
      )}

      <section className="mb-6" aria-label="Timeline">
        <h2 className="section-title mb-2">Timeline</h2>
        <ol className="divide-y divide-border border-y border-border text-sm">
          {detail.events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                <span className="font-semibold">
                  {e.from_status ? `${WO_STATUS[e.from_status].label} → ${WO_STATUS[e.to_status].label}` : "Opened"}
                </span>
                {e.changed_by_name ? <span className="text-muted-foreground"> · {e.changed_by_name}</span> : null}
                {e.note ? <span className="block text-xs text-muted-foreground">{e.note}</span> : null}
              </span>
              {e.changed_at && (
                <span className="font-mono text-xs text-muted-foreground">{localDateTime(e.changed_at, zone)}</span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {hasAnyRole(roles, WORK_ORDER_WRITERS) && WO_NEXT[wo.status].length > 0 && (
        <WorkOrderActions
          workOrderId={wo.id}
          next={WO_NEXT[wo.status]}
          squawk={
            squawk && squawk.status !== "resolved" && !squawk.is_rii && hasAnyRole(roles, AIRWORTHINESS_WRITERS)
              ? { id: squawk.id, grounding: squawk.severity === "grounding" }
              : null
          }
        />
      )}
    </div>
  );
}

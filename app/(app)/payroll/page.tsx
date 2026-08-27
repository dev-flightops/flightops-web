import Link from "next/link";
import { isoDayToUtcDate } from "@/lib/iso-day";

import { ApiError } from "@/lib/api/client";
import {
  listPayEvents,
  PAY_EVENT_TYPE_LABELS,
  type PayEventRow,
  type PayEventStatus,
} from "@/lib/api/payroll";

import { ApproveRejectButtons } from "./row-actions";

/**
 * /payroll — Pay Events list.
 *
 * Backed by flightops-services PR #114 (auth-service /payroll/*).
 * Legacy peregrineflight.com/payroll/ renders `templates/payroll/
 * events.html`: title + count subtitle, "Pay Periods" and "+ New
 * Pay Event" CTAs top-right, filter row, then a table of events
 * (Date / Employee / Type / Hours / Amount / Status / Description +
 * inline Approve/Reject actions on pending rows).
 */

export const dynamic = "force-dynamic";

const STATUS_TABS: readonly {
  value: PayEventStatus | "";
  label: string;
}[] = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "exported", label: "Exported" },
];

function parseStatus(
  v: string | string[] | undefined,
): PayEventStatus | "" {
  const s = Array.isArray(v) ? v[0] : v;
  if (
    s === "pending" ||
    s === "approved" ||
    s === "rejected" ||
    s === "exported"
  ) {
    return s;
  }
  return "";
}

function formatMoney(amount: string | null): string {
  if (!amount) return "—";
  const n = parseFloat(amount);
  return `$${n.toFixed(2)}`;
}

function formatHours(hours: string | null): string {
  if (!hours) return "—";
  return parseFloat(hours).toFixed(2);
}

function formatEventDate(iso: string): string {
  // Parsed as UTC to match the UTC formatter below. Without that the
  // string parses in the host's zone and a date east of Greenwich
  // renders as the day before — see lib/iso-day.ts.
  const d = isoDayToUtcDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function PayrollEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);

  let events: PayEventRow[] = [];
  let loadError: string | null = null;
  try {
    const response = await listPayEvents(
      statusFilter ? { status: statusFilter } : {},
    );
    events = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You need Exec Admin to view payroll."
          : "Pay events unavailable. Try refreshing in a moment.";
  }

  const total = events.length;

  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay Events</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total} event{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payroll/periods"
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
          >
            Pay Periods
          </Link>
          <Link
            href="/payroll/new"
            className="rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
          >
            + New Pay Event
          </Link>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((t) => {
          const active = t.value === statusFilter;
          const href = t.value ? `/payroll?status=${t.value}` : "/payroll";
          return (
            <Link
              key={t.label}
              href={href}
              className={
                "rounded-md px-3 py-1.5 text-xs font-semibold " +
                (active
                  ? "bg-status-blue text-white"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
          No pay events found.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Employee</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Hours</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                  <th scope="col" className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatEventDate(e.event_date)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {e.employee_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {PAY_EVENT_TYPE_LABELS[e.event_type]}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {formatHours(e.hours)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                      {formatMoney(e.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PayEventStatusBadge status={e.status} />
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                      {e.description ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {e.status === "pending" && !e.is_exported ? (
                        <ApproveRejectButtons eventId={e.id} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PayEventStatusBadge({ status }: { status: PayEventStatus }) {
  const map: Record<PayEventStatus, [string, string]> = {
    pending: [
      "border-border bg-muted/20 text-muted-foreground",
      "Pending",
    ],
    approved: [
      "border-status-green/40 bg-status-green/10 text-status-green",
      "Approved",
    ],
    rejected: [
      "border-status-red/40 bg-status-red/10 text-status-red",
      "Rejected",
    ],
    exported: [
      "border-status-blue/40 bg-status-blue/10 text-status-blue",
      "Exported",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

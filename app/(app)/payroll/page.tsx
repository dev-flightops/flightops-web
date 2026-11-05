import Link from "next/link";
import { isoDayToUtcDate } from "@/lib/iso-day";

import { ApiError } from "@/lib/api/client";
import {
  listPayEvents,
  PAY_EVENT_TYPE_LABELS,
  type PayEventRow,
  type PayEventSource,
  type PayEventStatus,
} from "@/lib/api/payroll";

import { ApproveRejectButtons, PayEventRange } from "./row-actions";

/**
 * /payroll — Pay Events list.
 *
 * Backed by flightops-services PR #114 (auth-service /payroll/*).
 * Legacy peregrineflight.com/payroll/ renders `templates/payroll/
 * events.html`: title + count subtitle, "Pay Periods" and "+ New
 * Pay Event" CTAs top-right, filter row, then a table of events
 * (Date / Employee / Type / Hours / Amount / Status / Description +
 * inline Approve/Reject actions on pending rows).
 *
 * Flights that land and shifts that clock out make their own events (#134),
 * so the list reads by date range too, and a range can be approved at once.
 */

export const dynamic = "force-dynamic";
// Bring up to date reads every flight and shift in the range.
export const maxDuration = 60;

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

/** The API's limits: a page with no dates, and a page with them. */
const LATEST = 200;
const IN_RANGE = 1000;

const SOURCE_LABELS: Record<PayEventSource, string> = {
  clock: "From the clock",
  flight: "From the flight",
  manual: "Entered by hand",
};

function parseDay(v: string | string[] | undefined): string {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
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
  searchParams: Promise<{
    status?: string | string[];
    start?: string | string[];
    end?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);
  const start = parseDay(params.start);
  const end = parseDay(params.end);
  const dated = Boolean(start || end);
  const limit = dated ? IN_RANGE : LATEST;

  let events: PayEventRow[] = [];
  let loadError: string | null = null;
  try {
    const response = await listPayEvents({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(start ? { start } : {}),
      ...(end ? { end } : {}),
      ...(dated ? { limit } : {}),
    });
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Pay Events</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {total} event{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/payroll/periods"
            className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Pay Periods
          </Link>
          <Link
            href="/payroll/new"
            className="btn-caps rounded-md bg-primary px-3 py-2 text-white hover:bg-brand-dark text-[0.72rem]"
          >
            + New Pay Event
          </Link>
        </div>
      </header>

      <PayEventRange status={statusFilter} start={start} end={end} />

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((t) => {
          const active = t.value === statusFilter;
          const query = new URLSearchParams({
            ...(t.value ? { status: t.value } : {}),
            ...(start ? { start } : {}),
            ...(end ? { end } : {}),
          }).toString();
          const href = query ? `/payroll?${query}` : "/payroll";
          return (
            <Link
              key={t.label}
              href={href}
              className={
                "rounded-md px-3 py-1.5 text-xs font-semibold " +
                (active
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {!loadError && total >= limit ? (
        <p role="status" className="mb-3 text-xs font-semibold text-status-yellow">
          Showing the latest {limit}. There may be more: choose dates to see them.
        </p>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
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
              <thead className="ff-thead">
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
                  <tr key={e.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatEventDate(e.event_date)}
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold">
                      {e.employee_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {PAY_EVENT_TYPE_LABELS[e.event_type]}
                      <span className="block text-[0.65rem]">
                        {SOURCE_LABELS[e.source]}
                      </span>
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
                    <td className="max-w-md px-4 py-3 text-xs text-muted-foreground">
                      {e.description ?? ""}
                      {e.notes ? (
                        <span
                          className={
                            "mt-1 block " +
                            (e.needs_check ? "font-semibold text-status-yellow" : "")
                          }
                        >
                          {e.notes}
                        </span>
                      ) : null}
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
      "text-muted-foreground",
      "Pending",
    ],
    approved: [
      "text-status-green",
      "Approved",
    ],
    rejected: [
      "text-status-red",
      "Rejected",
    ],
    exported: [
      "text-status-blue",
      "Exported",
    ],
  };
  const [cls, label] = map[status];
  return (
    <span
      className={
        "status-mark " +
        cls
      }
    >
      {label}
    </span>
  );
}

import Link from "next/link";
import { isoDayToUtcDate } from "@/lib/iso-day";

import { ApiError } from "@/lib/api/client";
import {
  listPayPeriods,
  type PayPeriodRow,
  type PayPeriodStatus,
} from "@/lib/api/payroll";

import { LockExportButtons, NewPeriodForm } from "./period-controls";

/**
 * /payroll/periods — Pay Periods list.
 *
 * Backed by flightops-services PR #114 auth-service /payroll/periods.
 * Mirrors legacy `templates/payroll/periods.html`: title + "+ New
 * Period" toggle-form, then a table of periods with Lock/Export
 * actions based on status.
 */

export const dynamic = "force-dynamic";

function formatDateOnly(iso: string): string {
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

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function PayrollPeriodsPage() {
  let periods: PayPeriodRow[] = [];
  let loadError: string | null = null;
  try {
    const response = await listPayPeriods({ limit: 50 });
    periods = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You need Exec Admin to view pay periods."
          : "Pay periods unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link
          href="/payroll"
          className="hover:text-foreground"
        >
          Pay Events
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          /
        </span>
        <span className="text-foreground">Pay Periods</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Pay Periods</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Group approved pay events into a period, lock the period, then
          export a CSV for your payroll provider.
        </p>
      </header>

      <div className="mb-5 rounded-lg border border-border bg-card p-4">
        <NewPeriodForm />
      </div>

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : periods.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          No pay periods defined yet. Create your first one above.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Period</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Locked</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Exported</th>
                  <th scope="col" className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {periods.map((p) => (
                  <tr key={p.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                      {formatDateOnly(p.period_start)} — {formatDateOnly(p.period_end)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <PeriodStatusBadge status={p.status} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(p.locked_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {formatDateTime(p.exported_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <LockExportButtons
                        periodId={p.id}
                        status={p.status}
                        startIso={p.period_start}
                        endIso={p.period_end}
                      />
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

function PeriodStatusBadge({ status }: { status: PayPeriodStatus }) {
  const map: Record<PayPeriodStatus, [string, string]> = {
    open: [
      "text-muted-foreground",
      "Open",
    ],
    review: [
      "text-muted-foreground",
      "Review",
    ],
    locked: [
      "text-status-yellow",
      "Locked",
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

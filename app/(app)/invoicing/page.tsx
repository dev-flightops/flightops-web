import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listCustomerInvoices,
  type CustomerInvoice,
  type InvoiceStatus,
} from "@/lib/api/customer-invoices";

import {
  isOverdue,
  money,
  STATUS_LABELS,
  statusClasses,
} from "./money";

/**
 * /invoicing — what customers owe us for flights flown.
 *
 * Legacy's `templates/invoicing/invoices.html`: a filterable list with
 * the status on each row. Distinct from Settings → Billing, which is
 * the operator's own subscription with us.
 *
 * Two things the list says that legacy's does not:
 *
 * Outstanding is a tenant-wide figure from the service, not a sum of
 * the rows on screen. A header total that changes when you paginate is
 * worse than no header total.
 *
 * A draft carrying an unpriced line is flagged in the list rather than
 * only on the detail page. It cannot be sent, and finding that out
 * after opening it is a wasted trip.
 */

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusParam } = await searchParams;
  const status = STATUSES.includes(statusParam as InvoiceStatus)
    ? (statusParam as InvoiceStatus)
    : undefined;

  let items: CustomerInvoice[] = [];
  let total = 0;
  let outstanding = 0;
  let loadError: string | null = null;

  try {
    const data = await listCustomerInvoices({ status, limit: 100 });
    items = data.items;
    total = data.total;
    outstanding = data.outstanding_cents;
  } catch (err) {
    const code = err instanceof ApiError ? err.status : 0;
    loadError =
      code === 403
        ? "Invoicing is limited to executive admins and the director of operations."
        : "Could not load invoices just now.";
  }

  const today = todayUtc();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Invoices
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} invoice{total === 1 ? "" : "s"}
            {status ? ` · ${STATUS_LABELS[status].toLowerCase()}` : ""}
          </p>
        </div>
        {!loadError && (
          <div className="text-right">
            <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Outstanding
            </div>
            <div className="text-xl font-bold tabular-nums text-foreground">
              {money(outstanding)}
            </div>
            {/* Said plainly: this covers the whole operation, not the
                rows below, which may be filtered. */}
            <div className="text-[0.65rem] text-muted-foreground">
              draft + sent, all invoices
            </div>
          </div>
        )}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : (
        <>
          <nav
            aria-label="Filter by status"
            className="mb-4 flex flex-wrap gap-1"
          >
            <FilterChip label="All" href="/invoicing" active={!status} />
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={STATUS_LABELS[s]}
                href={`/invoicing?status=${s}`}
                active={status === s}
              />
            ))}
          </nav>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center text-sm text-muted-foreground">
              {status
                ? `No ${STATUS_LABELS[status].toLowerCase()} invoices.`
                : "No invoices yet. They are raised from a flown flight on the dispatch board."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th scope="col" className="px-4 py-3">Invoice</th>
                    <th scope="col" className="px-4 py-3">Customer</th>
                    <th scope="col" className="px-4 py-3">Flight</th>
                    <th scope="col" className="px-4 py-3">Issued</th>
                    <th scope="col" className="px-4 py-3">Due</th>
                    <th scope="col" className="px-4 py-3 text-right">Total</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inv) => {
                    const overdue = isOverdue(inv.status, inv.due_date, today);
                    return (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0 hover:bg-muted/20"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/invoicing/${inv.id}`}
                            className="font-mono font-semibold text-status-blue hover:underline"
                          >
                            {inv.invoice_number}
                          </Link>
                          {inv.has_unpriced_lines && (
                            // Flagged here, not only on the detail
                            // page: it cannot be sent, and finding that
                            // out after opening it is a wasted trip.
                            <span className="ml-2 rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-status-yellow">
                              needs pricing
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-foreground">
                          {inv.customer?.full_name ?? (
                            <span className="text-muted-foreground">
                              Walk-in
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {inv.flight_number ?? "—"}
                          {inv.origin_icao && inv.destination_icao
                            ? ` · ${inv.origin_icao}→${inv.destination_icao}`
                            : ""}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                          {inv.invoice_date}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">
                          <span
                            className={
                              overdue
                                ? "font-semibold text-status-red"
                                : "text-muted-foreground"
                            }
                          >
                            {inv.due_date ?? "—"}
                          </span>
                          {overdue && (
                            <span className="ml-1.5 text-[0.6rem] font-semibold uppercase text-status-red">
                              overdue
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-foreground">
                          {money(inv.total_cents)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={
                              "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase " +
                              statusClasses(inv.status)
                            }
                          >
                            {STATUS_LABELS[inv.status]}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md border px-3 py-1.5 text-xs font-semibold transition " +
        (active
          ? "border-status-blue bg-status-blue/15 text-status-blue"
          : "border-border bg-background text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

import Link from "next/link";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listCustomers } from "@/lib/api/reservations";
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
import { RaiseInvoices } from "./raise-invoices";

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
 * worse than no header total. It is what customers owe: sent invoices
 * less the payments against them. Drafts are not counted until they
 * are sent, the same rule as AR aging, so the two pages agree.
 *
 * A draft carrying an unpriced line is flagged in the list rather than
 * only on the detail page. It cannot be sent, and finding that out
 * after opening it is a wasted trip.
 */

export const dynamic = "force-dynamic";

const STATUSES: InvoiceStatus[] = ["draft", "sent", "paid", "void"];

function invoicingHref(status: InvoiceStatus | undefined, customer: string | undefined): string {
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (customer) q.set("customer", customer);
  const qs = q.toString();
  return qs ? `/invoicing?${qs}` : "/invoicing";
}

/** The operator's active customers for the filter. Empty when they can't
 *  be read: the list still works, without the filter (#30). */
async function customerOptions(): Promise<{ id: string; name: string }[]> {
  try {
    const { items } = await listCustomers({ limit: 200 });
    return items
      .map((c) => ({
        id: c.id,
        name: c.customer_type === "individual" ? c.full_name : c.company_name || c.full_name,
      }))
      .sort((x, y) => x.name.localeCompare(y.name));
  } catch {
    return [];
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function InvoicingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; customer?: string }>;
}) {
  const { status: statusParam, customer: customerParam } = await searchParams;
  const status = STATUSES.includes(statusParam as InvoiceStatus)
    ? (statusParam as InvoiceStatus)
    : undefined;
  const customer =
    customerParam && /^[0-9a-f-]{36}$/i.test(customerParam) ? customerParam : undefined;
  const customers = await customerOptions();
  const customerName = customers.find((c) => c.id === customer)?.name;
  // The company may invoice outside Peregrine (#95). Losing the profile
  // reads as on, the default, rather than hiding Raise invoices.
  const invoicingOn = await getCompanyProfile()
    .then((p) => p.invoicing_in_peregrine !== false)
    .catch(() => true);

  let items: CustomerInvoice[] = [];
  let total = 0;
  let outstanding = 0;
  let loadError: string | null = null;

  try {
    const data = await listCustomerInvoices({ status, customer_id: customer, limit: 100 });
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title text-balance">
            Invoices
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {total} invoice{total === 1 ? "" : "s"}
            {status ? ` · ${STATUS_LABELS[status].toLowerCase()}` : ""}
          </p>
        </div>
        {/* Where legacy had "+ New Invoice". Hidden with the list when
            the list is refused: the same two roles may raise. */}
        {!loadError && invoicingOn && <RaiseInvoices />}
        {!loadError && (
          <div className="text-right">
            <div className="eyebrow">
              Outstanding
            </div>
            <div className="mt-1 font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground">
              {money(outstanding)}
            </div>
            {/* Said plainly: this covers the whole operation, or the
                chosen customer, not just the rows below, which a status
                may filter. */}
            <div className="text-[0.65rem] text-muted-foreground">
              sent, less payments ·{" "}
              {customer ? (customerName ?? "this customer") : "all invoices"}
            </div>
          </div>
        )}
      </header>

      {!invoicingOn && (
        <div role="status" className="notice notice-yellow mb-6 text-sm">
          This company invoices outside Peregrine, so landings raise no invoices
          and flights close out without them. Invoices already raised stay here.
          Turn invoicing on under{" "}
          <Link href="/settings/company" className="font-semibold text-primary hover:underline">
            Settings → Company
          </Link>
          .
        </div>
      )}

      {loadError ? (
        <p
          role="alert"
          className="notice notice-red text-sm"
        >
          {loadError}
        </p>
      ) : (
        <>
          <nav
            aria-label="Filter by status"
            className="mb-4 flex flex-wrap gap-1"
          >
            <FilterChip label="All" href={invoicingHref(undefined, customer)} active={!status} />
            {STATUSES.map((s) => (
              <FilterChip
                key={s}
                label={STATUS_LABELS[s]}
                href={invoicingHref(s, customer)}
                active={status === s}
              />
            ))}
          </nav>
          {customers.length > 0 ? (
            <form
              method="get"
              action="/invoicing"
              role="search"
              className="mb-4 flex flex-wrap items-end gap-2"
            >
              {status ? <input type="hidden" name="status" value={status} /> : null}
              <label className="text-xs text-muted-foreground">
                <span className="mb-1 block">Customer</span>
                <select
                  name="customer"
                  defaultValue={customer ?? ""}
                  className="ff-input w-60 px-3 py-1.5 text-sm"
                >
                  <option value="">All customers</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="btn-caps rounded-md border border-input px-3 py-1.5 text-foreground hover:bg-accent"
              >
                Filter
              </button>
            </form>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              {status
                ? `No ${STATUS_LABELS[status].toLowerCase()} invoices.`
                : "No invoices yet. Raise a flown flight's invoices with Raise invoices above."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="ff-thead">
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
                        className="border-b border-border last:border-0 hover:bg-accent"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/invoicing/${inv.id}`}
                            className="font-mono font-semibold text-primary hover:underline"
                          >
                            {inv.invoice_number}
                          </Link>
                          {inv.has_unpriced_lines && (
                            // Flagged here, not only on the detail
                            // page: it cannot be sent, and finding that
                            // out after opening it is a wasted trip.
                            <span className="status-mark text-status-yellow ml-2">
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
                          <span className={statusClasses(inv.status)}>
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
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

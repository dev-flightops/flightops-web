import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getCustomerInvoice,
  type CustomerInvoiceDetail,
} from "@/lib/api/customer-invoices";

import {
  isOverdue,
  money,
  quantity,
  STATUS_LABELS,
  statusClasses,
} from "../money";
import { InvoiceActions } from "./invoice-actions";

/**
 * /invoicing/{id} — one invoice, as the customer will see it.
 *
 * Legacy's `templates/invoicing/invoice_detail.html`: header, bill-to
 * and flight, lines, totals, and the lifecycle buttons.
 *
 * The layout deliberately mirrors the PDF
 * (`services/billing/app/customer_invoicing/pdf.py`) — same order, same
 * money formatting from `../money.ts`. Somebody checking a figure on
 * screen against the document they sent should not have to translate
 * between two layouts.
 */

export const dynamic = "force-dynamic";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;

  let invoice: CustomerInvoiceDetail;
  try {
    invoice = await getCustomerInvoice(invoiceId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-8">
          <p
            role="alert"
            className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
          >
            Invoicing is limited to executive admins and the director of
            operations.
          </p>
        </div>
      );
    }
    throw err;
  }

  const overdue = isOverdue(invoice.status, invoice.due_date, todayUtc());
  const flightBits = [
    invoice.flight_number,
    invoice.origin_icao && invoice.destination_icao
      ? `${invoice.origin_icao} → ${invoice.destination_icao}`
      : null,
    invoice.flight_date,
    invoice.aircraft_tail,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/invoicing"
        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← Invoices
      </Link>

      <header className="mt-1 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {invoice.invoice_number}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span
              className={
                "rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase " +
                statusClasses(invoice.status)
              }
            >
              {STATUS_LABELS[invoice.status]}
            </span>
            {overdue && (
              <span className="rounded bg-status-red/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-status-red">
                overdue
              </span>
            )}
            {invoice.has_unpriced_lines && (
              <span className="rounded bg-status-yellow/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase text-status-yellow">
                needs pricing
              </span>
            )}
          </div>
        </div>
        <InvoiceActions
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          status={invoice.status}
          hasUnpricedLines={invoice.has_unpriced_lines}
        />
      </header>

      {invoice.status === "void" && (
        <p className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Voided.</span>{" "}
          {invoice.void_reason ?? "No reason recorded."}
        </p>
      )}

      <section className="mb-6 grid grid-cols-2 gap-4 rounded-lg border border-border bg-card p-5 sm:grid-cols-4">
        <Field label="Bill to">
          {invoice.customer?.full_name ?? "Walk-in customer"}
        </Field>
        <Field label="Flight">{flightBits.join(" · ") || "—"}</Field>
        <Field label="Issued">{invoice.invoice_date}</Field>
        <Field label={invoice.status === "paid" ? "Paid" : "Due"}>
          {invoice.status === "paid"
            ? (invoice.paid_on ?? "—")
            : (invoice.due_date ?? "—")}
        </Field>
      </section>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Lines on invoice {invoice.invoice_number}
          </caption>
          <thead>
            <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <th scope="col" className="px-4 py-3">Description</th>
              <th scope="col" className="px-4 py-3 text-right">Qty</th>
              <th scope="col" className="px-4 py-3 text-right">Unit</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-2.5 text-foreground">
                  {line.description}
                  {line.unpriced && (
                    <span className="ml-2 rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-status-yellow">
                      no price
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {quantity(line.quantity_milli)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {money(line.unit_price_cents)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                  {money(line.amount_cents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                Subtotal
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">
                {money(invoice.subtotal_cents)}
              </td>
            </tr>
            {(invoice.tax_cents > 0 || invoice.tax_rate) && (
              <tr>
                <td colSpan={3} className="px-4 py-2 text-right text-muted-foreground">
                  Tax
                  {invoice.tax_rate
                    ? ` (${(Number(invoice.tax_rate) * 100)
                        .toFixed(3)
                        .replace(/0+$/, "")
                        .replace(/\.$/, "")}%)`
                    : ""}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-foreground">
                  {money(invoice.tax_cents)}
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-border bg-background/40 font-semibold">
              <td colSpan={3} className="px-4 py-2.5 text-right text-muted-foreground">
                Total
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                {money(invoice.total_cents)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {invoice.notes && (
        <section className="mt-4 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes
          </h2>
          <p className="text-sm text-foreground">{invoice.notes}</p>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

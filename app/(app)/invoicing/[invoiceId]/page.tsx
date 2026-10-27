import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { listStaff } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  getCustomerInvoice,
  type CustomerInvoiceDetail,
} from "@/lib/api/customer-invoices";
import { REFUND_APPROVERS, hasAnyRole } from "@/lib/roles";

import {
  isOverdue,
  money,
  quantity,
  STATUS_LABELS,
  statusClasses,
  unitPrice,
} from "../money";
import { ApplyCredit } from "./apply-credit";
import { InvoiceActions } from "./invoice-actions";
import { PaymentHistory } from "./payment-history";
import { RecordPayment } from "./record-payment";
import { type Approver, Refunds } from "./refunds";

/**
 * /invoicing/{id} — one invoice, as the customer will see it.
 *
 * Legacy's `templates/invoicing/invoice_detail.html`: header, bill-to
 * and flight, lines, totals, and the lifecycle buttons. Then what
 * legacy's page did not have: what has been paid, what is outstanding,
 * the payments themselves, and a form to record one. Legacy's invoice
 * carried only a paid date, so a part payment had nowhere to go.
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

/** Who may approve a refund over $500 (#127): everyone on the staff
 *  holding the role, but not the person entering it. None when the
 *  directory can't be read; the form then says one is needed. */
async function refundApprovers(): Promise<Approver[]> {
  const me = (await auth())?.user?.email?.toLowerCase() ?? "";
  try {
    const { items } = await listStaff();
    return items
      .filter((p) => hasAnyRole(p.roles, REFUND_APPROVERS) && p.email.toLowerCase() !== me)
      .map((p) => ({ id: p.id, name: p.full_name || p.email }));
  } catch {
    return [];
  }
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
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
          <p
            role="alert"
            className="notice notice-red text-sm"
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
  // What can still be given back (#127): received and not yet refunded.
  const refundable = invoice.paid_cents - invoice.refunded_cents;
  const canRefund =
    (invoice.status === "sent" || invoice.status === "paid") && refundable > 0;
  const approvers = canRefund ? await refundApprovers() : [];
  const flightBits = [
    invoice.flight_number,
    invoice.origin_icao && invoice.destination_icao
      ? `${invoice.origin_icao} → ${invoice.destination_icao}`
      : null,
    invoice.flight_date,
    invoice.aircraft_tail,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <Link
        href="/invoicing"
        className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}
      >
        <span aria-hidden>‹</span> Invoices
      </Link>

      <header className="mb-6 mt-3 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title text-balance">
            {invoice.invoice_number}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className={statusClasses(invoice.status)}>
              {STATUS_LABELS[invoice.status]}
            </span>
            {overdue && (
              <span className="status-mark text-status-red">
                overdue
              </span>
            )}
            {invoice.has_unpriced_lines && (
              <span className="status-mark text-status-yellow">
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
          paidCents={refundable}
          outstandingCents={invoice.outstanding_cents}
        />
      </header>

      {invoice.status === "void" && (
        <p className="notice notice-gray mb-4 text-sm text-muted-foreground">
          <span className="notice-label">Voided</span>
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
            <tr className="ff-thead">
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
                    <span className="status-mark text-status-yellow ml-2">
                      no price
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {quantity(line.quantity_milli)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {unitPrice(line)}
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

      {/* A draft cannot take money until it is sent; anything else
          that has had money shows it, a void included. */}
      {(invoice.status !== "draft" || invoice.payments.length > 0) && (
        <section
          aria-labelledby="payments-heading"
          className="mt-4 rounded-lg border border-border bg-card p-5"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
            <h2
              id="payments-heading"
              className="eyebrow"
            >
              Payments
            </h2>
            <dl className="flex gap-6 text-right">
              <div>
                <dt className="eyebrow">
                  Paid
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {money(invoice.paid_cents)}
                </dd>
              </div>
              {invoice.refunded_cents > 0 && (
                <div>
                  <dt className="eyebrow">
                    Refunded
                  </dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">
                    {money(invoice.refunded_cents)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="eyebrow">
                  Outstanding
                </dt>
                <dd className="text-sm font-semibold tabular-nums text-foreground">
                  {money(invoice.outstanding_cents)}
                </dd>
              </div>
            </dl>
          </div>

          <PaymentHistory
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoice_number}
            payments={invoice.payments}
          />

          {/* Always mounted while payments show: a payment that settles
              the invoice turns canRecord off, and its confirmation has
              to outlive that. */}
          <RecordPayment
            invoiceId={invoice.id}
            outstandingCents={invoice.outstanding_cents}
            canRecord={
              invoice.status === "sent" && invoice.outstanding_cents > 0
            }
          />
          <ApplyCredit
            invoiceId={invoice.id}
            creditNotes={invoice.credit_notes}
            outstandingCents={invoice.outstanding_cents}
            canApply={
              invoice.status === "sent" && invoice.outstanding_cents > 0
            }
          />
        </section>
      )}

      {invoice.status !== "draft" && (
        <Refunds
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoice_number}
          refunds={invoice.refunds}
          payments={invoice.payments}
          refundableCents={refundable}
          hasCustomer={invoice.customer !== null}
          canRefund={canRefund}
          approvers={approvers}
        />
      )}

      {invoice.notes && (
        <section className="mt-4 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-1 eyebrow">
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
      <div className="eyebrow">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-foreground">{children}</div>
    </div>
  );
}

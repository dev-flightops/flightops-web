/**
 * Customer portal API — wraps reservations-service /portal/* and, for the
 * customer's invoices (#129), billing-service /billing/portal/*.
 *
 *   GET /reservations/portal/charters          the caller's own charters
 *   GET /reservations/portal/charters/{id}     one of them
 *   GET /billing/portal/invoices               the invoices sent to them
 *   GET /billing/portal/invoices/{id}/pdf      one of them as its PDF
 *
 * Read-only by design. Legacy's portal offers no booking, cancellation
 * or self-service change, so there is nothing here that writes.
 *
 * A portal user is an ordinary user whose email matches a customer
 * record in the same tenant; the backend resolves that link. When there
 * is no match the dashboard still returns 200 with `profile.linked`
 * false, because an ops user opening the portal is not an error — the
 * page renders the "contact operations" state instead.
 */

import { apiFetch } from "./client";
import { type CharterStatus } from "./charter";

export interface PortalCharterRow {
  id: string;
  /** Short human reference, e.g. "CHR-4A19C2". Derived server-side. */
  reference: string;
  origin_icao: string;
  destination_icao: string;
  requested_date: string;
  requested_time: string | null;
  return_date: string | null;
  return_time: string | null;
  pax_count: number;
  cargo_lbs: string;
  aircraft_type_requested: string | null;
  special_requirements: string | null;
  status: CharterStatus;
  quoted_total_cents: number | null;
  // NOTE: no `notes` field. That column carries operational shorthand
  // written for staff and is deliberately not exposed to customers.
}

export interface PortalProfile {
  linked: boolean;
  customer_id: string | null;
  display_name: string | null;
}

export interface PortalDashboardResponse {
  profile: PortalProfile;
  items: PortalCharterRow[];
  total: number;
}

export async function getPortalDashboard(): Promise<PortalDashboardResponse> {
  return apiFetch<PortalDashboardResponse>("/reservations/portal/charters");
}

export async function getPortalCharter(
  charterId: string,
): Promise<PortalCharterRow> {
  return apiFetch<PortalCharterRow>(
    `/reservations/portal/charters/${charterId}`,
  );
}

/** One invoice as its customer sees it (#129). Only invoices sent to them
 *  come back: never a draft, another customer's or another company's. */
export interface PortalInvoiceRow {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  flight_number: string | null;
  flight_date: string | null;
  origin_icao: string | null;
  destination_icao: string | null;
  total_cents: number;
  /** Received against it; voided payments don't count. */
  paid_cents: number;
  /** Still owed: zero once it is paid or void. */
  balance_cents: number;
  status: "sent" | "paid" | "void";
}

export interface PortalInvoicesResponse {
  /** False when the login matches no customer; the dashboard's profile
   *  says the same, so the page shows its "not linked" note instead. */
  linked: boolean;
  items: PortalInvoiceRow[];
  /** Owed across every invoice listed. */
  balance_cents: number;
}

export async function getPortalInvoices(): Promise<PortalInvoicesResponse> {
  return apiFetch<PortalInvoicesResponse>("/billing/portal/invoices");
}

/** The invoice's PDF as base64: it sits behind a bearer token the browser
 *  doesn't hold, so it crosses a server action, where a Buffer doesn't
 *  survive. The same document staff send. */
export async function getPortalInvoicePdfBase64(invoiceId: string): Promise<string> {
  return apiFetch<string>(`/billing/portal/invoices/${invoiceId}/pdf`, {
    parseAs: "base64",
    cache: "no-store",
  });
}

/** Cents → "$1,234.56". Null quote renders as a dash upstream. */
export function formatQuote(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

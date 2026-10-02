/**
 * Raising a flown flight's invoices, the parts that are not React and
 * not a server action: how a flight reads in the picker, what the
 * result lists, and what a refusal says.
 *
 * Kept apart from `raise-actions.ts` because a "use server" module may
 * only export async functions, and from the component so the wording
 * can be tested without rendering it.
 */

import { ApiError, SessionExpiredError } from "@/lib/api/client";
import type { GenerateResult } from "@/lib/api/customer-invoices";
import type { FlightListItem } from "@/lib/api/types";
import { formatZuluDateTime } from "@/lib/format/flight-time";

/** How many flown flights the picker offers, newest first. */
export const RECENT_FLOWN_FLIGHTS = 50;

export interface FlownFlightOption {
  id: string;
  /** "PGR733 · PANC → PAOM · Sep 28, 16:00z · N733RX" */
  label: string;
}

export function flownFlightOption(f: FlightListItem): FlownFlightOption {
  const bits = [
    f.flight_number,
    `${f.origin} → ${f.destination}`,
    // Zulu, with the date, as the rest of the app shows flight times:
    // the picker must not say a different day from the board.
    formatZuluDateTime(f.scheduled_departure_at),
    f.aircraft?.tail_number,
  ].filter(Boolean);
  return { id: f.id, label: bits.join(" · ") };
}

export type FlownFlightsState =
  | { status: "ok"; flights: FlownFlightOption[] }
  | { status: "error"; message: string };

export interface RaisedInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  totalCents: number;
  hasUnpricedLines: boolean;
}

export interface SkippedLine {
  customer: string;
  reason: string;
}

export type RaiseState =
  | { status: "idle" }
  | {
      status: "ok";
      created: RaisedInvoice[];
      skipped: SkippedLine[];
      notes: string[];
    }
  | { status: "error"; message: string };

/** The service's answer, as the panel lists it. */
export function raisedFrom(result: GenerateResult): RaiseState {
  return {
    status: "ok",
    created: result.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      customer: inv.customer?.full_name ?? "Walk-in customer",
      totalCents: inv.total_cents,
      hasUnpricedLines: inv.has_unpriced_lines,
    })),
    skipped: result.skipped.map((s) => ({
      customer: s.customer?.full_name ?? "A deleted customer",
      reason: s.reason,
    })),
    notes: result.notes ?? [],
  };
}

/** Service refusals in words. A slug is not something to put in front
 *  of somebody trying to bill a flight. */
const REFUSALS: Record<string, string> = {
  invoice_generation_in_progress:
    "This flight's invoices are being raised right now, in another tab " +
    "or by someone else. Wait a moment, then check the list below.",
  flight_has_not_flown:
    "That flight has not flown yet, so there is nothing to invoice.",
  flight_not_found: "That flight no longer exists.",
};

export function explainRaiseError(err: unknown): string {
  if (err instanceof SessionExpiredError) {
    return "Your session has expired. Sign in again.";
  }
  if (err instanceof ApiError) {
    for (const [slug, sentence] of Object.entries(REFUSALS)) {
      if (String(err.message).includes(slug)) return sentence;
    }
    if (err.status === 403) {
      return "Raising invoices is limited to executive admins and the director of operations.";
    }
    return `Could not raise the invoices (HTTP ${err.status}).`;
  }
  return "Could not reach billing-service.";
}

export function explainFlightsError(err: unknown): string {
  if (err instanceof SessionExpiredError) {
    return "Your session has expired. Sign in again.";
  }
  if (err instanceof ApiError) {
    return `Could not load the flown flights (HTTP ${err.status}).`;
  }
  return "Could not reach ops-service for the flown flights.";
}

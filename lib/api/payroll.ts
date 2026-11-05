/**
 * Payroll API — wraps auth-service /payroll/* endpoints
 * (flightops-services PR #114). All EXEC_ADMIN-gated:
 *
 *   GET  /auth/payroll/events?status=&employee_id=&start=&end=
 *   POST /auth/payroll/events                  create (pending)
 *   POST /auth/payroll/events/{id}/approve     approve|reject
 *   POST /auth/payroll/events/generate         bring a date range up to date
 *   POST /auth/payroll/events/approve-pending  approve what needs no second look
 *   GET  /auth/payroll/periods
 *   POST /auth/payroll/periods
 *   POST /auth/payroll/periods/{id}/lock
 *   POST /auth/payroll/periods/{id}/export     returns text/csv
 */

import { apiFetch } from "./client";

export type PayEventType =
  | "flight_pay"
  | "duty_pay"
  | "training_pay"
  | "standby_pay"
  | "per_diem"
  | "expense"
  | "overtime"
  | "deduction";

export const PAY_EVENT_TYPES: readonly PayEventType[] = [
  "flight_pay",
  "duty_pay",
  "training_pay",
  "standby_pay",
  "per_diem",
  "expense",
  "overtime",
  "deduction",
];

export const PAY_EVENT_TYPE_LABELS: Record<PayEventType, string> = {
  flight_pay: "Flight Pay",
  duty_pay: "Duty Pay",
  training_pay: "Training Pay",
  standby_pay: "Standby Pay",
  per_diem: "Per Diem",
  expense: "Expense",
  overtime: "Overtime",
  deduction: "Deduction",
};

export type PayEventStatus = "pending" | "approved" | "rejected" | "exported";

export type PayPeriodStatus = "open" | "review" | "locked" | "exported";

/** A flight or a clocked shift makes its own events; the rest are by hand. */
export type PayEventSource = "clock" | "flight" | "manual";

export interface PayEventRow {
  id: string;
  employee_user_id: string;
  employee_name: string | null;
  event_type: PayEventType;
  hours: string | null;
  amount: string | null;
  event_date: string;
  flight_id: string | null;
  duty_period_id: string | null;
  source: PayEventSource;
  /** Someone should look at this one: Approve all leaves it pending. */
  needs_check: boolean;
  status: PayEventStatus;
  approved_by_user_id: string | null;
  approved_at: string | null;
  pay_period_id: string | null;
  is_exported: boolean;
  description: string | null;
  notes: string | null;
}

export interface PayEventListResponse {
  items: PayEventRow[];
}

export interface PayEventCreateRequest {
  employee_user_id: string;
  event_type: PayEventType;
  hours?: string;
  amount?: string;
  event_date: string; // YYYY-MM-DD
  flight_id?: string;
  description?: string;
  notes?: string;
}

export async function listPayEvents(
  params: {
    status?: PayEventStatus;
    employee_id?: string;
    start?: string;
    end?: string;
    limit?: number;
  } = {},
): Promise<PayEventListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.employee_id) search.set("employee_id", params.employee_id);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<PayEventListResponse>(`/auth/payroll/events${qs}`);
}

export async function createPayEvent(
  body: PayEventCreateRequest,
): Promise<PayEventRow> {
  return apiFetch<PayEventRow>("/auth/payroll/events", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function approvePayEvent(
  eventId: string,
  action: "approve" | "reject",
): Promise<PayEventRow> {
  return apiFetch<PayEventRow>(`/auth/payroll/events/${eventId}/approve`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export interface PayEventGenerateResponse {
  created: number;
  updated: number;
  removed: number;
}

/** Settle everything flown or clocked in a date range. Safe to press twice. */
export async function generatePayEvents(
  start: string,
  end: string,
): Promise<PayEventGenerateResponse> {
  return apiFetch<PayEventGenerateResponse>("/auth/payroll/events/generate", {
    method: "POST",
    body: JSON.stringify({ start, end }),
  });
}

export interface PayEventApprovePendingResponse {
  approved: number;
  left_to_check: number;
}

export async function approvePendingPayEvents(
  start: string,
  end: string,
): Promise<PayEventApprovePendingResponse> {
  return apiFetch<PayEventApprovePendingResponse>(
    "/auth/payroll/events/approve-pending",
    {
      method: "POST",
      body: JSON.stringify({ start, end }),
    },
  );
}

export interface PayPeriodRow {
  id: string;
  period_start: string;
  period_end: string;
  status: PayPeriodStatus;
  locked_by_user_id: string | null;
  locked_at: string | null;
  exported_at: string | null;
  notes: string | null;
  /** What an export would leave out: only approved events go. */
  pending_events: number;
  still_clocked_in: number;
}

export interface PayPeriodListResponse {
  items: PayPeriodRow[];
}

export async function listPayPeriods(
  params: { limit?: number } = {},
): Promise<PayPeriodListResponse> {
  const qs = params.limit ? `?limit=${params.limit}` : "";
  return apiFetch<PayPeriodListResponse>(`/auth/payroll/periods${qs}`);
}

export async function createPayPeriod(body: {
  period_start: string;
  period_end: string;
  notes?: string;
}): Promise<PayPeriodRow> {
  return apiFetch<PayPeriodRow>("/auth/payroll/periods", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function lockPayPeriod(periodId: string): Promise<PayPeriodRow> {
  return apiFetch<PayPeriodRow>(`/auth/payroll/periods/${periodId}/lock`, {
    method: "POST",
  });
}

/**
 * Export a locked period to ADP-format CSV. Returns the raw CSV
 * text so the caller can either offer a download or stream it into
 * an accounting system. Backend flips events to `exported` state
 * and writes a payroll_exports audit row as a side effect.
 */
export async function exportPayPeriodCsv(periodId: string): Promise<string> {
  return apiFetch<string>(`/auth/payroll/periods/${periodId}/export`, {
    method: "POST",
    parseAs: "text",
  });
}

/**
 * Typed wrappers around ops-service endpoints.
 */

import { apiFetch } from "./client";
import type {
  AircraftListResponse,
  AuditTimelineResponse,
  ComplianceBoardResponse,
  CpReviewCreateRequest,
  CpReviewDecisionRequest,
  CpReviewListResponse,
  CpReviewResponse,
  CpReviewStatus,
  CurrencyItemRef,
  CurrentDutyResponse,
  CustomCurrencyItemCreateRequest,
  CustomCurrencyItemUpdateRequest,
  LogCompletionRequest,
  LogCompletionResponse,
  OverrideRequest,
  OverrideResponse,
  PicComplianceResponse,
  PilotProfileResponse,
  DutyHistoryResponse,
  DutyPeriodSummary,
  FlightDetail,
  FlightListResponse,
  FlightLogCreateRequest,
  FlightLogListResponse,
  FlightLogLeg,
  FlightLogLegCreateRequest,
  FlightLogLegListResponse,
  FlightLogLegUpdateRequest,
  FlightLogLifecycleRequest,
  FlightLogResponse,
  FlightLogStatus,
  FlightLogSubmitResponse,
  FlightLogUpdateRequest,
  FlightStats,
  FlightStatus,
  FratAssessmentResponse,
  FratAuthorizeRequest,
  FratSubmitRequest,
  PilotAcceptanceRequest,
  PilotAcceptanceResponse,
  PreflightProgressResponse,
  ReleaseResponse,
  StepCompletionRequest,
  StepCompletionResponse,
} from "./types";

export interface ListFlightsParams {
  onDate?: string; // YYYY-MM-DD (UTC)
  /** Single or multiple statuses. Multi-value lands as repeated
   *  `?status=` params, which FastAPI delivers as a list (M2-M-15). */
  status?: FlightStatus | FlightStatus[];
  limit?: number;
  offset?: number;
}

export async function listFlights(
  params: ListFlightsParams = {},
): Promise<FlightListResponse> {
  const search = new URLSearchParams();
  if (params.onDate) search.set("on_date", params.onDate);
  if (params.status) {
    const values = Array.isArray(params.status) ? params.status : [params.status];
    for (const s of values) search.append("status", s);
  }
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FlightListResponse>(`/ops/flights${qs}`);
}

export interface FlightCreatePayload {
  flight_number: string;
  aircraft_id: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;  // ISO 8601 UTC
  scheduled_arrival_at: string;
  pax_count?: number;
  cargo_lbs?: number;
  notes?: string | null;
}

export async function createFlight(
  payload: FlightCreatePayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>("/ops/flights", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getFlight(flightId: string): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}`);
}

export async function releaseFlight(
  flightId: string,
  /** M2-M-5 — when the dispatcher picked a PIC via ?pic=<uuid>,
   *  pass it here so the backend runs the compliance gate. Legacy
   *  callers without a PIC skip the check (M2 transitional). */
  pilotUserId?: string | null,
  /** M2-G-5 tail — when true, backend skips the pic_hard_blocked
   *  gate because the caller has already recorded currency_overrides
   *  rows (audit trail lives there). */
  overridesAcknowledged?: boolean,
): Promise<ReleaseResponse> {
  const body: Record<string, unknown> = {};
  if (pilotUserId) body.pilot_user_id = pilotUserId;
  if (overridesAcknowledged) body.overrides_acknowledged = true;
  return apiFetch<ReleaseResponse>(`/ops/flights/${flightId}/release`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Transition a flight from `scheduled` → `cancelled` (M2-M-18).
 *  Used by the M2-G-25 EOD page's bulk "Cancel stale flights" action. */
export async function cancelFlight(flightId: string): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}/cancel`, {
    method: "POST",
  });
}

export interface CheckInPayload {
  event: "depart" | "arrive";
  /** Optional override; defaults to server-side now() on the backend. */
  at?: string | null;
}

/** Record actual departure or arrival on a released flight (M2-M-19).
 *  Arrival also flips the status to `completed` server-side. */
export async function checkInFlight(
  flightId: string,
  payload: CheckInPayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}/check-in`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface FlightUpdatePayload {
  flight_number?: string;
  aircraft_id?: string;
  origin?: string;
  destination?: string;
  scheduled_departure_at?: string; // ISO 8601 UTC
  scheduled_arrival_at?: string;
  pax_count?: number;
  cargo_lbs?: number;
  notes?: string | null;
}

export async function updateFlight(
  flightId: string,
  patch: FlightUpdatePayload,
): Promise<FlightDetail> {
  return apiFetch<FlightDetail>(`/ops/flights/${flightId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function getFlightStats(): Promise<FlightStats> {
  return apiFetch<FlightStats>("/ops/flights/stats");
}

export async function listAircraft(): Promise<AircraftListResponse> {
  return apiFetch<AircraftListResponse>("/ops/aircraft");
}

// ---- Electronic Flight Log (M2-M-21 / M2-G-26b) ----------------------------

export interface ListFlightLogsParams {
  status?: FlightLogStatus | FlightLogStatus[];
  aircraftId?: string;
  /** Filter to logs created by the current user. Server reads the
   *  user id from the JWT so the client doesn't need to know its own. */
  mine?: boolean;
  /** Inclusive lower bound on flight_date (YYYY-MM-DD). */
  fromDate?: string;
  /** Inclusive upper bound on flight_date (YYYY-MM-DD). */
  toDate?: string;
  limit?: number;
}

/** Fetch flight logs, optionally filtered by status, aircraft,
 *  creator, and a flight-date range. Powers the elog landing's
 *  Active Drafts panel + the Spec 4 step 5 /flight-crew/history
 *  page's Flight tab. */
export async function listFlightLogs(
  params: ListFlightLogsParams = {},
): Promise<FlightLogListResponse> {
  const search = new URLSearchParams();
  if (params.status) {
    const values = Array.isArray(params.status) ? params.status : [params.status];
    for (const s of values) search.append("status", s);
  }
  if (params.aircraftId) search.set("aircraft_id", params.aircraftId);
  if (params.mine) search.set("mine", "true");
  if (params.fromDate) search.set("from_date", params.fromDate);
  if (params.toDate) search.set("to_date", params.toDate);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<FlightLogListResponse>(`/ops/flight-logs${qs}`);
}

/** Create a new draft flight log. Backs the "Start Flight Log"
 *  submit action on the elog landing. */
export async function createFlightLog(
  payload: FlightLogCreateRequest,
): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>("/ops/flight-logs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Fetch a single flight log — drives the 7-tab elog detail page. */
export async function getFlightLog(id: string): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>(`/ops/flight-logs/${id}`);
}

/** Flip a draft log to submitted. Returns the updated row so the
 *  caller can swap state without a follow-up GET. */
export async function submitFlightLog(
  id: string,
): Promise<FlightLogSubmitResponse> {
  return apiFetch<FlightLogSubmitResponse>(
    `/ops/flight-logs/${id}/submit`,
    { method: "POST" },
  );
}

/** Partial PATCH of a flight log. Today carries Spec 4 Tab 6 VOR
 *  check fields; Tab 7 fields land here when they ship. */
export async function updateFlightLog(
  id: string,
  body: FlightLogUpdateRequest,
): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>(`/ops/flight-logs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** M2-M-10: submitted → draft within the 90-day creator window. */
export async function reopenFlightLog(
  id: string,
  body: FlightLogLifecycleRequest = {},
): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>(`/ops/flight-logs/${id}/reopen`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** M2-M-10: soft-delete a flight log (drafts always; submitted only
 *  within 90 days). Returns the updated row with deleted_at set. */
export async function deleteFlightLog(
  id: string,
  body: FlightLogLifecycleRequest = {},
): Promise<FlightLogResponse> {
  return apiFetch<FlightLogResponse>(`/ops/flight-logs/${id}/delete`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** M2-M-10b: pilot creator opens a CP review for an out-of-window
 *  reopen / delete. Refuses inside the 90-day window — use reopen /
 *  delete directly there. */
export async function requestCpReview(
  logId: string,
  body: CpReviewCreateRequest,
): Promise<CpReviewResponse> {
  return apiFetch<CpReviewResponse>(`/ops/flight-logs/${logId}/cp-review`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export interface ListCpReviewsParams {
  status?: CpReviewStatus;
  limit?: number;
}

/** M2-M-10b: CP queue. 403 for non-CP callers; defaults to pending
 *  when no status is supplied. */
export async function listCpReviews(
  params: ListCpReviewsParams = {},
): Promise<CpReviewListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const qs = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<CpReviewListResponse>(`/ops/flight-log-cp-reviews${qs}`);
}

export async function approveCpReview(
  reviewId: string,
  body: CpReviewDecisionRequest = {},
): Promise<CpReviewResponse> {
  return apiFetch<CpReviewResponse>(
    `/ops/flight-log-cp-reviews/${reviewId}/approve`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function declineCpReview(
  reviewId: string,
  body: CpReviewDecisionRequest = {},
): Promise<CpReviewResponse> {
  return apiFetch<CpReviewResponse>(
    `/ops/flight-log-cp-reviews/${reviewId}/decline`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/** M2-M-10c: unified history timeline for the elog detail page —
 *  audit mutations + CP-review events interleaved chronologically. */
export async function getFlightLogAuditTimeline(
  logId: string,
): Promise<AuditTimelineResponse> {
  return apiFetch<AuditTimelineResponse>(
    `/ops/flight-logs/${logId}/audit-timeline`,
  );
}

// ---- Pilot duty tracking (Spec 4 §"Duty time tracking") ----

export async function getCurrentDuty(): Promise<CurrentDutyResponse> {
  return apiFetch<CurrentDutyResponse>("/ops/duty/current");
}

export async function clockIn(
  body: { rest_acknowledged?: boolean } = {},
): Promise<DutyPeriodSummary> {
  return apiFetch<DutyPeriodSummary>("/ops/duty/clock-in", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function clockOut(
  body: { reason?: string } = {},
): Promise<DutyPeriodSummary> {
  return apiFetch<DutyPeriodSummary>("/ops/duty/clock-out", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listDutyHistory(
  params: { limit?: number; offset?: number } = {},
): Promise<DutyHistoryResponse> {
  const qs = new URLSearchParams();
  if (params.limit !== undefined) qs.set("limit", String(params.limit));
  if (params.offset !== undefined) qs.set("offset", String(params.offset));
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<DutyHistoryResponse>(`/ops/duty/history${tail}`);
}

// ---- 8-step preflight job flow (Spec 4 §"8-STEP PREFLIGHT JOB FLOW") ----

export async function getPreflightProgress(
  flightId: string,
): Promise<PreflightProgressResponse> {
  return apiFetch<PreflightProgressResponse>(`/ops/preflight/${flightId}`);
}

export async function completePreflightStep(
  flightId: string,
  stepNumber: number,
  body: StepCompletionRequest = {},
): Promise<StepCompletionResponse> {
  return apiFetch<StepCompletionResponse>(
    `/ops/preflight/${flightId}/steps/${stepNumber}`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

// ---- FRAT — Flight Risk Assessment Tool (Spec 4 §"The 8 steps / 4") ----

export async function submitFratAssessment(
  flightId: string,
  body: FratSubmitRequest,
): Promise<FratAssessmentResponse> {
  return apiFetch<FratAssessmentResponse>(`/ops/frat/${flightId}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getLatestFratAssessment(
  flightId: string,
): Promise<FratAssessmentResponse> {
  return apiFetch<FratAssessmentResponse>(`/ops/frat/${flightId}/latest`);
}

export async function recordFratAuthorization(
  flightId: string,
  body: FratAuthorizeRequest,
): Promise<FratAssessmentResponse> {
  return apiFetch<FratAssessmentResponse>(
    `/ops/frat/${flightId}/authorize`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

// ---- Pilot Accept/Deny release (Spec 4 §"The 8 steps / 6") ----

export async function submitPilotAcceptance(
  flightId: string,
  body: PilotAcceptanceRequest,
): Promise<PilotAcceptanceResponse> {
  return apiFetch<PilotAcceptanceResponse>(
    `/ops/flights/${flightId}/pilot-acceptance`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export async function getLatestPilotAcceptance(
  flightId: string,
): Promise<PilotAcceptanceResponse> {
  return apiFetch<PilotAcceptanceResponse>(
    `/ops/flights/${flightId}/pilot-acceptance/latest`,
  );
}

// ---- Spec 5 Compliance ----------------------------------------------------

export interface ListComplianceBoardParams {
  /** Filter cells to listed statuses (repeated query param). */
  status?: string[];
}

/** Fleet compliance board — pilot × currency-item grid + summary chips. */
export async function getComplianceBoard(
  params: ListComplianceBoardParams = {},
): Promise<ComplianceBoardResponse> {
  const qs = new URLSearchParams();
  for (const s of params.status ?? []) qs.append("status", s);
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<ComplianceBoardResponse>(`/ops/compliance/board${tail}`);
}

/** Per-pilot currency profile — header + all-item cells. */
export async function getPilotComplianceProfile(
  pilotId: string,
): Promise<PilotProfileResponse> {
  return apiFetch<PilotProfileResponse>(
    `/ops/compliance/pilots/${pilotId}/profile`,
  );
}

/** M2-C-2 — create a tenant-scoped currency item. Chief pilot only. */
export async function createCurrencyItem(
  body: CustomCurrencyItemCreateRequest,
): Promise<CurrencyItemRef> {
  return apiFetch<CurrencyItemRef>("/ops/currency-items", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** M2-C-2 — patch a tenant-scoped currency item. Rejects with 403 on defaults. */
export async function updateCurrencyItem(
  itemId: string,
  body: CustomCurrencyItemUpdateRequest,
): Promise<CurrencyItemRef> {
  return apiFetch<CurrencyItemRef>(`/ops/currency-items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** M2-C-2 — soft-deactivate a tenant-scoped currency item. */
export async function deactivateCurrencyItem(
  itemId: string,
): Promise<CurrencyItemRef> {
  return apiFetch<CurrencyItemRef>(`/ops/currency-items/${itemId}`, {
    method: "DELETE",
  });
}

/** Log a new currency completion. Backs the Log Completion modal. */
export async function logCurrencyCompletion(
  body: LogCompletionRequest,
): Promise<LogCompletionResponse> {
  return apiFetch<LogCompletionResponse>("/ops/compliance/completions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Real-time PIC compliance check — backs the dispatch packet's
 *  status dot, hard-block list, and soft-warning ack list. Spec 5
 *  mandates this isn't cached: every call hits live state. */
export async function getPicCompliance(
  pilotId: string,
): Promise<PicComplianceResponse> {
  return apiFetch<PicComplianceResponse>(
    `/ops/compliance/pic-check?pilot_id=${pilotId}`,
  );
}

/** Record a supervisor override. Reason min 50 chars enforced by
 *  the backend (Pydantic schema). Returns the persisted row. */
export async function createComplianceOverride(
  body: OverrideRequest,
): Promise<OverrideResponse> {
  return apiFetch<OverrideResponse>("/ops/compliance/overrides", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ---- Spec 4 elog Tab 2 (Legs) ---------------------------------------------

/** List legs for a flight log, ordered by leg_number. */
export async function listFlightLogLegs(
  logId: string,
): Promise<FlightLogLegListResponse> {
  return apiFetch<FlightLogLegListResponse>(
    `/ops/flight-logs/${logId}/legs`,
  );
}

/** Append a new leg. Server assigns leg_number = max + 1. */
export async function addFlightLogLeg(
  logId: string,
  body: FlightLogLegCreateRequest = {},
): Promise<FlightLogLeg> {
  return apiFetch<FlightLogLeg>(`/ops/flight-logs/${logId}/legs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Partial update — only the fields in `body` are written. */
export async function updateFlightLogLeg(
  logId: string,
  legId: string,
  body: FlightLogLegUpdateRequest,
): Promise<FlightLogLeg> {
  return apiFetch<FlightLogLeg>(
    `/ops/flight-logs/${logId}/legs/${legId}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
}

/** Remove a leg. Backend returns 204; apiFetch handles the no-body
 *  response shape directly. Backend preserves gaps in leg_number. */
export async function deleteFlightLogLeg(
  logId: string,
  legId: string,
): Promise<void> {
  await apiFetch<void>(
    `/ops/flight-logs/${logId}/legs/${legId}`,
    { method: "DELETE" },
  );
}

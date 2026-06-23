/**
 * Typed wrappers around ops-service endpoints.
 */

import { apiFetch } from "./client";
import type {
  AircraftListResponse,
  ComplianceBoardResponse,
  CurrentDutyResponse,
  LogCompletionRequest,
  LogCompletionResponse,
  PilotProfileResponse,
  DutyHistoryResponse,
  DutyPeriodSummary,
  FlightDetail,
  FlightListResponse,
  FlightLogCreateRequest,
  FlightLogListResponse,
  FlightLogResponse,
  FlightLogStatus,
  FlightLogSubmitResponse,
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

export async function releaseFlight(flightId: string): Promise<ReleaseResponse> {
  return apiFetch<ReleaseResponse>(`/ops/flights/${flightId}/release`, {
    method: "POST",
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

/** Log a new currency completion. Backs the Log Completion modal. */
export async function logCurrencyCompletion(
  body: LogCompletionRequest,
): Promise<LogCompletionResponse> {
  return apiFetch<LogCompletionResponse>("/ops/compliance/completions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

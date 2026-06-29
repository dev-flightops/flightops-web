/**
 * TypeScript mirrors of the Pydantic schemas in services/ops/app/schemas.py.
 * Hand-maintained for now; we'll generate from OpenAPI in a later story.
 */

export type FlightStatus = "scheduled" | "released" | "cancelled" | "completed";

export interface AircraftRef {
  id: string;
  tail_number: string;
  /** Nullable since flightops-services migration 0023 — aircraft
   *  imported without a confirmed airframe come through as null
   *  rather than the literal "Unknown" string the backend used to
   *  stamp. UI surfaces use `displayModel()` helpers that render
   *  null (or any stray "Unknown") as "No details". */
  model: string | null;
  seats: number;
  /** Spec 4 Tab 5 — airframe-family slug ("caravan" / "kingair" /
   *  "navajo" / "c207" / "ga8") so the trend form can pick the
   *  right input set. Nullable for aircraft imported without the
   *  airframe metadata set. */
  airframe_type?: string | null;
}

export interface AircraftListItem {
  id: string;
  tail_number: string;
  model: string | null;
  seats: number;
  max_payload_lbs: number | null;
  is_active: boolean;
}

export interface AircraftListResponse {
  items: AircraftListItem[];
  total: number;
}

export interface UserRef {
  id: string;
  full_name: string;
  email: string;
}

export interface FlightListItem {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string; // ISO 8601 UTC
  scheduled_arrival_at: string;
  status: FlightStatus;
  aircraft: AircraftRef;
  /** Check-in actuals (M2-M-19); lifted onto the list shape in
   *  M2-M-20a so list views can render real flown hours. Null while
   *  the flight is in scheduled / released-but-not-yet-departed /
   *  cancelled state. Optional in TS so existing mock factories that
   *  predate M2-M-20a stay valid — the backend always emits the
   *  field (defaults to null), so consumers narrow with
   *  `?? scheduled_*_at` either way. */
  actual_departure_at?: string | null;
  actual_arrival_at?: string | null;
}

export interface FlightDetail extends FlightListItem {
  pax_count: number;
  cargo_lbs: number;
  notes: string | null;
  max_payload_lbs: number | null;
  released_at: string | null;
  released_by: UserRef | null;
}

export interface FlightListResponse {
  items: FlightListItem[];
  total: number;
}

// Electronic Flight Log (M2-M-21 backend / M2-G-26b frontend)

export type FlightLogStatus = "draft" | "submitted";
export type FlightType =
  | "advisory"
  | "charter"
  | "training"
  | "ferry"
  | "other";

export type VorCheckType = "ground" | "airborne" | "vot" | "dual";

export interface FlightLogResponse {
  id: string;
  log_number: string;          // LOG-YYYYMMDD-HHMMSS
  aircraft: AircraftRef;
  flight_id: string | null;
  flight_number: string | null;
  flight_type: FlightType;
  flight_date: string;         // YYYY-MM-DD
  status: FlightLogStatus;
  /** Permanent flag — true when the pilot started this log without a
   *  dispatch packet (ferry, training, historical entry). Drives the
   *  amber MANUAL ENTRY badge on Tab 1 + the flight history row. */
  is_manual_entry: boolean;
  created_by: UserRef;
  created_at: string;          // ISO 8601 UTC
  // Spec 4 Tab 6 — VOR 30-day check (FAA 91.171). All optional —
  // non-IFR flights leave the form empty.
  vor_identifier?: string | null;
  vor_check_type?: VorCheckType | null;
  vor_station_facility?: string | null;
  vor_location?: string | null;
  vor_bearing_indicated?: number | null;
  vor_bearing_known?: number | null;
  /** Computed: indicated - known (signed). Null when either bearing
   *  is missing. UI handles the tolerance check per check_type
   *  (+/- 4° for ground/vot/dual, +/- 6° for airborne). */
  vor_error_degrees?: number | null;
  vor_checked_at?: string | null;
  vor_certified?: boolean;
  /** Spec 4 Tab 7 — freeform maintenance discrepancies. Auto-fires
   *  a Maintenance work order on submission (M2-M-9). */
  mx_discrepancy?: string | null;
  /** Spec 4 Tab 4 — pilot-writable currency counters. Null = not
   *  entered (em-dash); 0 = explicitly zero today. The M2-M-9b
   *  recompute uses the distinction to bump only the days the pilot
   *  actually flew vs days they haven't logged yet. */
  night_takeoffs?: number | null;
  approach_precision?: number | null;
  approach_non_precision?: number | null;
  holds?: number | null;
  ifr_actual_minutes?: number | null;
  ifr_simulated_minutes?: number | null;
  /** SIC currency track. `sic_user` is the SIC pilot ref (null on
   *  single-pilot flights); the sic_* counters mirror the PIC set
   *  and feed sic_*_currency rolling-count records on submit. */
  sic_user?: UserRef | null;
  sic_night_takeoffs?: number | null;
  sic_approach_precision?: number | null;
  sic_approach_non_precision?: number | null;
  sic_holds?: number | null;
  sic_ifr_actual_minutes?: number | null;
  sic_ifr_simulated_minutes?: number | null;
  /** M2-M-10 lifecycle anchors. `submitted_at` is set when status
   *  flips draft → submitted and anchors the 90-day reopen window
   *  the UI counts down from. `deleted_at` is always null on
   *  responses today (deleted rows are filtered out server-side)
   *  but kept on the shape so an admin/audit endpoint can echo it
   *  without a schema fork. */
  submitted_at?: string | null;
  deleted_at?: string | null;
}

/** M2-M-10 — body shared by POST /flight-logs/{id}/reopen and
 *  /delete. Optional pilot context captured in the audit row. */
export interface FlightLogLifecycleRequest {
  reason?: string | null;
}

/** M2-M-10b — pilot opens a CP review for an out-of-window
 *  reopen/delete. The reason text is shown to the CP in the queue. */
export type CpReviewAction = "reopen" | "delete";
export type CpReviewStatus = "pending" | "approved" | "declined";

export interface CpReviewCreateRequest {
  requested_action: CpReviewAction;
  requested_reason?: string | null;
}

export interface CpReviewDecisionRequest {
  reviewer_note?: string | null;
}

export interface CpReviewResponse {
  id: string;
  flight_log_id: string;
  log_number: string;
  requested_action: CpReviewAction;
  requested_by: UserRef;
  requested_reason: string | null;
  requested_at: string;
  status: CpReviewStatus;
  reviewed_by: UserRef | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
}

export interface CpReviewListResponse {
  items: CpReviewResponse[];
  total: number;
}

/** M2-M-10c — unified history timeline for the elog detail page.
 *  Each event is one row on the timeline (audit mutation or CP-
 *  review request/decision). */
export type AuditTimelineKind =
  | "submit"
  | "reopen"
  | "delete"
  | "cp_review_requested"
  | "cp_review_approved"
  | "cp_review_declined";

export interface AuditTimelineEvent {
  kind: AuditTimelineKind;
  occurred_at: string;
  actor: UserRef;
  note: string | null;
}

export interface AuditTimelineResponse {
  items: AuditTimelineEvent[];
}

export interface FlightLogUpdateRequest {
  vor_identifier?: string | null;
  vor_check_type?: VorCheckType | null;
  vor_station_facility?: string | null;
  vor_location?: string | null;
  vor_bearing_indicated?: number | null;
  vor_bearing_known?: number | null;
  vor_checked_at?: string | null;
  vor_certified?: boolean | null;
  mx_discrepancy?: string | null;
  night_takeoffs?: number | null;
  approach_precision?: number | null;
  approach_non_precision?: number | null;
  holds?: number | null;
  ifr_actual_minutes?: number | null;
  ifr_simulated_minutes?: number | null;
  /** SIC currency track. Sending null on `sic_user_id` clears the
   *  SIC assignment on the log. */
  sic_user_id?: string | null;
  sic_night_takeoffs?: number | null;
  sic_approach_precision?: number | null;
  sic_approach_non_precision?: number | null;
  sic_holds?: number | null;
  sic_ifr_actual_minutes?: number | null;
  sic_ifr_simulated_minutes?: number | null;
}

export interface FlightLogListResponse {
  items: FlightLogResponse[];
  total: number;
}

export interface FlightLogSubmitResponse {
  log: FlightLogResponse;
}

// ---- Spec 4 elog Tab 2 (Legs) ---------------------------------------------

export type PilotFlying = "pic" | "sic";

export interface FlightLogLeg {
  id: string;
  flight_log_id: string;
  leg_number: number;
  origin_icao: string | null;
  dest_icao: string | null;
  /** HH:MM:SS clock time (UTC) — pair with the parent log's
   *  `flight_date` to reconstruct a datetime. Null while a draft
   *  leg is still being filled in. */
  engine_on: string | null;
  blocks_off: string | null;
  blocks_on: string | null;
  engine_off: string | null;
  crosses_midnight: boolean;
  start_hobbs: number | null;
  end_hobbs: number | null;
  landings: number;
  night_landings: number;
  pilot_flying: PilotFlying;
  routing: string | null;
  // Spec 4 Tab 3 — Weight & Balance inputs (lbs except fuel_gallons).
  basic_empty_weight_lbs: number | null;
  pilot_weight_lbs: number | null;
  sic_weight_lbs: number | null;
  pax_weight_lbs: number | null;
  baggage_weight_lbs: number | null;
  cargo_weight_lbs: number | null;
  fuel_gallons: number | null;
  fuel_weight_lbs: number | null;
  /** Spec 4 Tab 5 — per-airframe trend monitoring blob.
   *  Empty object on legs without trends entered. */
  trend_data: Record<string, number | string | null>;
}

export interface FlightLogLegCreateRequest {
  origin_icao?: string | null;
  dest_icao?: string | null;
  engine_on?: string | null;
  blocks_off?: string | null;
  blocks_on?: string | null;
  engine_off?: string | null;
  crosses_midnight?: boolean;
  start_hobbs?: number | null;
  end_hobbs?: number | null;
  landings?: number;
  night_landings?: number;
  pilot_flying?: PilotFlying;
  routing?: string | null;
  basic_empty_weight_lbs?: number | null;
  pilot_weight_lbs?: number | null;
  sic_weight_lbs?: number | null;
  pax_weight_lbs?: number | null;
  baggage_weight_lbs?: number | null;
  cargo_weight_lbs?: number | null;
  fuel_gallons?: number | null;
  fuel_weight_lbs?: number | null;
  trend_data?: Record<string, number | string | null>;
}

export type FlightLogLegUpdateRequest = FlightLogLegCreateRequest;

export interface FlightLogLegListResponse {
  items: FlightLogLeg[];
}

export interface FlightLogCreateRequest {
  aircraft_id: string;
  flight_id?: string | null;
  flight_number?: string | null;
  flight_type?: FlightType;
  /** YYYY-MM-DD; defaults server-side to today (UTC). */
  flight_date?: string | null;
}

export interface ReleaseResponse {
  flight: FlightDetail;
  released_at: string;
  released_by: UserRef;
}

export interface StatusCounts {
  scheduled: number;
  released: number;
  cancelled: number;
  completed: number;
  total: number;
}

export interface FlightStats {
  today: StatusCounts;
  this_week: StatusCounts;
  aircraft_total: number;
  aircraft_active: number;
  last_release_at: string | null;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  is_current: boolean;
}

export interface TenantsResponse {
  tenants: TenantSummary[];
}

export interface SwitchTenantResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  tenant_id: string;
}

// SSO scaffolding (M1-M-5 / M1-G-5)

export interface ProviderSummary {
  id: string;       // "google" | "microsoft-entra-id" | "okta" — matches Auth.js provider id
  label: string;    // human-readable, e.g. "Google"
}

export interface ProvidersResponse {
  providers: ProviderSummary[];
}

// Weather (M2-M-3 backend / M2-G-1 frontend)

export type WeatherKind = "metar" | "taf" | "pirep";

/** FAA flight category — derived from raw METAR by weather-service (M2-M-11).
 *  Only populated for METAR responses; TAF + PIREP always return null. */
export type FlightCategory = "VFR" | "MVFR" | "IFR" | "LIFR";

export interface WeatherReportResponse {
  icao: string;
  kind: WeatherKind;
  raw: string;
  parsed_at: string;   // ISO 8601 UTC — when we last fetched from AWC
  valid_until: string; // ISO 8601 UTC — cache TTL boundary
  cache_hit: boolean;  // true if served from weather_reports, false if AWC was hit
  flight_category: FlightCategory | null;
  /** True when the current METAR is below the FAR 91.169 alternate
   *  threshold (ceiling < 2000 ft OR vis < 3 SM). Only set for METAR;
   *  TAFs always return null (period-based — separate problem). */
  alternate_required: boolean | null;
  // Parsed METAR fields (M2-M-14). All null for TAF responses.
  visibility_sm: number | null;
  /** None = unlimited (clear or scattered-only). */
  ceiling_ft: number | null;
  /** null = variable / unmeasured / calm — check `wind_variable` and `wind_calm`. */
  wind_direction_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;
  wind_variable: boolean;
  wind_calm: boolean;
  temp_c: number | null;
  dewpoint_c: number | null;
  /** European Q-codes converted to inHg server-side. */
  altimeter_in_hg: number | null;
}

// Batch weather (M2-M-12)

export interface WeatherBatchRequestItem {
  icao: string;
  kind: "metar" | "taf";
}

export interface WeatherBatchItemError {
  icao: string;
  kind: string;
  status: number;  // 400 | 404 | 502 — matches GET-route status code
  detail: string;
}

export interface WeatherBatchResponse {
  items: WeatherReportResponse[];
  errors: WeatherBatchItemError[];
}

// Saved weather briefings (M2-M-22 backend / M2-G-27 frontend)

export interface WeatherBriefingFlightRef {
  id: string;
  flight_number: string;
}

export interface WeatherBriefingAircraftRef {
  id: string;
  tail_number: string;
}

export interface WeatherBriefingUserRef {
  id: string;
  full_name: string;
  email: string;
}

export interface WeatherBriefingListItem {
  id: string;
  airports: string[];
  flight: WeatherBriefingFlightRef | null;
  aircraft: WeatherBriefingAircraftRef | null;
  worst_flight_category: FlightCategory | null;
  briefed_by: WeatherBriefingUserRef;
  created_at: string;  // ISO 8601 UTC
}

export interface WeatherBriefingResponse extends WeatherBriefingListItem {
  dispatcher_notes: string | null;
  /** Frozen WeatherBatchResponse-shaped payload captured at briefing
   *  time. Detail page renders its airport cards directly from this. */
  snapshot: WeatherBatchResponse;
}

export interface WeatherBriefingListResponse {
  items: WeatherBriefingListItem[];
  total: number;
}

export interface WeatherBriefingCreateRequest {
  airports: string[];
  flight_id?: string | null;
  aircraft_id?: string | null;
  dispatcher_notes?: string | null;
}

// Maintenance / airworthiness (M2-M-8 backend / M2-G-5 frontend)

export type SquawkSeverity = "minor" | "major" | "grounding";

export type IssueKind =
  | "expired_mel"
  | "open_mel"
  | "grounding_squawk"
  | "major_squawk";

/**
 * Discriminated union by `kind` — backend returns a single shape with
 * nullable fields per variant. UI renders rows based on `kind` and
 * ignores fields not relevant to that variant.
 */
export interface BlockingIssue {
  kind: IssueKind;
  description: string;
  // MEL fields
  mel_item_id?: string | null;
  ata_chapter?: string | null;
  due_at?: string | null;
  days_overdue?: number | null;
  // Squawk fields
  squawk_id?: string | null;
  severity?: SquawkSeverity | null;
  reported_at?: string | null;
}

export interface AdvisoryIssue {
  kind: IssueKind;
  description: string;
  mel_item_id?: string | null;
  ata_chapter?: string | null;
  due_at?: string | null;
  days_until_due?: number | null;
  squawk_id?: string | null;
  severity?: SquawkSeverity | null;
  reported_at?: string | null;
}

/** Subset of AircraftRef returned by the maintenance-service — no seats
 * field, since airworthiness doesn't care about capacity. */
export interface MaintenanceAircraftRef {
  id: string;
  tail_number: string;
  model: string | null;
}

export interface AirworthinessResponse {
  aircraft: MaintenanceAircraftRef;
  is_airworthy: boolean;
  checked_at: string;
  blocking_issues: BlockingIssue[];
  advisory_issues: AdvisoryIssue[];
}

/** One row on the Maintenance fleet landing. Counts come from
 *  M2-M-16; the airframe metadata + time-tracking block (airframe_type
 *  through prop_tbo_hours) is M2-M-17. Backend defaults preserve
 *  back-compat — fields may be absent on responses from a service
 *  that's been deployed but not migrated. */
export interface FleetAircraftSummary {
  aircraft: MaintenanceAircraftRef;
  is_active: boolean;
  is_airworthy: boolean;
  checked_at: string;
  blocking_count: number;
  advisory_count: number;
  open_mel_count: number;
  open_squawk_count: number;
  // M2-M-17 — fleet-card display fields
  airframe_type: string | null;
  base: string | null;
  special_notes: string | null;
  total_time_hours: number;
  engine_time_hours: number;
  engine_tbo_hours: number | null;
  prop_time_hours: number;
  prop_tbo_hours: number | null;
}

export interface FleetAirworthinessResponse {
  items: FleetAircraftSummary[];
  total: number;
}

// MEL items (M2-M-7 backend / M2-G-6 frontend)

export type MelCategory = "A" | "B" | "C" | "D";
export type MelStatus = "open" | "closed";

export interface MelItemResponse {
  id: string;
  aircraft: MaintenanceAircraftRef;
  ata_chapter: string;
  description: string;
  category: MelCategory;
  deferred_at: string;
  due_at: string;
  status: MelStatus;
  closed_at: string | null;
  closed_by: UserRef | null;
  notes: string | null;
}

export interface MelItemCreateRequest {
  aircraft_id: string;
  ata_chapter: string;
  description: string;
  category: MelCategory;
  deferred_at: string;   // ISO 8601 UTC
  due_at: string;        // ISO 8601 UTC
  notes?: string | null;
}

export interface MelItemCloseRequest {
  /** Optional closing note. Backend appends to any existing notes
   *  rather than overwriting. */
  notes?: string | null;
}

export interface MelItemListResponse {
  items: MelItemResponse[];
  total: number;
}

// Squawks (M2-M-7 backend / M2-G-7 frontend)
// SquawkSeverity is declared earlier in the maintenance section — reuse it.

export type SquawkStatus = "open" | "in_progress" | "resolved";

export interface SquawkResponse {
  id: string;
  aircraft: MaintenanceAircraftRef;
  reported_at: string;
  reported_by: UserRef;
  title: string;
  description: string;
  severity: SquawkSeverity;
  status: SquawkStatus;
  resolved_at: string | null;
  resolved_by: UserRef | null;
  resolution_notes: string | null;
}

export interface SquawkCreateRequest {
  aircraft_id: string;
  reported_at: string;  // ISO 8601 UTC
  title: string;
  description: string;
  severity: SquawkSeverity;
}

export interface SquawkResolveRequest {
  /** Required — what was done to clear the discrepancy. Backend
   *  enforces min_length=1. */
  resolution_notes: string;
}

export interface SquawkListResponse {
  items: SquawkResponse[];
  total: number;
}

// Flight-following (M2-M-9 through M-13b backend / M2-G-8 frontend)

export type PositionSource = "adsb" | "gps" | "manual" | "simulated";

export interface PositionAircraftRef {
  id: string;
  tail_number: string;
  model: string | null;
}

export interface PositionResponse {
  id: string;
  aircraft: PositionAircraftRef;
  flight_id: string | null;
  latitude: number;
  longitude: number;
  altitude_ft: number | null;
  groundspeed_kt: number | null;
  heading_deg: number | null;
  source: PositionSource;
  reported_at: string;  // ISO 8601 UTC — observation time (track ordering)
  received_at: string;  // ISO 8601 UTC — ingest time
}

export interface PositionListResponse {
  items: PositionResponse[];
  total: number;
}

// Flight Following board (M2-M-14 backend / M2-G-11 frontend)

export type BoardView = "today" | "tomorrow" | "week" | "all";

export interface BoardFlightItem {
  id: string;
  flight_number: string;
  aircraft: AircraftRef;
  origin: string;
  destination: string;
  scheduled_departure_at: string;        // ISO 8601 UTC
  scheduled_arrival_at: string;
  /** Reserved for M2-M-14b (Check-In flow) — always null at M2-G-11. */
  actual_departure_at: string | null;
  actual_arrival_at: string | null;
  status: FlightStatus;
  pax_count: number;
  cargo_lbs: number;
  /** Reserved for the crew-assignment story (M3). Always null today. */
  pic_name: string | null;
  /** Computed: status==="released" AND now > scheduled_arrival_at + 30 min. */
  is_overdue: boolean;
  /** max(positions.reported_at) for this flight_id, or null. */
  last_contact_at: string | null;
}

export interface BoardResponse {
  items: BoardFlightItem[];
  view: BoardView;
  total: number;
}

// Ground (M2-M-25a backend / M2-G-38 frontend) -------------------------------

export type StationRunwaySource = "faa_api" | "manual" | "seeded";

// Spec 6 §"Add Station form / Station type" catalog.
export type StationType =
  | "hub_base"
  | "spoke_base"
  | "village_airport"
  | "maintenance_base"
  | "custom";

// Spec 6 §"Add Station form / Fuel types available".
export type FuelTypeName = "Jet A" | "100LL";

export interface StationListItem {
  id: string;
  icao_code: string;
  name: string;
  city: string | null;
  state: string | null;
  elevation_ft: number | null;
  // Spec 6: this column carries the Weather board inclusion semantics.
  has_reporting_function: boolean;
  // Spec 6 §"Add Station form" fields (migration 0026).
  station_type: StationType;
  is_hub: boolean;
  is_active: boolean;
  fuel_available: boolean;
  fuel_types_available: FuelTypeName[];
  primary_fuel_supplier_id: string | null;
  runway_length_ft: number | null;
  runway_width_ft: number | null;
  runway_primary_name: string | null;
  runway_source: StationRunwaySource | null;
  runway_cache_updated_at: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  open_issue_count: number;
}

export interface StationListResponse {
  items: StationListItem[];
  total: number;
}

export type StationIssueCategory =
  | "equipment"
  | "facilities"
  | "safety"
  | "ops"
  | "staffing"
  | "weather"
  | "fuel"
  | "comms"
  | "other";

export type StationIssuePriority = "low" | "normal" | "high" | "critical";

export type StationIssueStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export interface StationIssueStationRef {
  id: string;
  icao_code: string;
  name: string;
}

export interface StationIssueResponse {
  id: string;
  station: StationIssueStationRef;
  category: StationIssueCategory;
  priority: StationIssuePriority;
  status: StationIssueStatus;
  title: string;
  description: string;
  submitted_by: UserRef | null;
  submitted_date: string;     // YYYY-MM-DD
  assigned_to: string | null;
  resolution_notes: string | null;
  resolved_date: string | null;
  created_at: string;
}

export interface StationIssueListResponse {
  items: StationIssueResponse[];
  total: number;
}

// GSE (M2-M-25b backend / M2-G-39 frontend) ---------------------------------

export type GSEEquipmentType =
  | "tug"
  | "gpu"
  | "deice_truck"
  | "belt_loader"
  | "fuel_truck"
  | "lavatory"
  | "air_start"
  | "heater"
  | "other";

export type GSEUnitStatus = "operational" | "maintenance" | "out_of_service";

export type GSEMxItemType =
  | "service"
  | "inspection"
  | "calibration"
  | "certification"
  | "custom";

export type GSEMxStatus = "current" | "due_soon" | "overdue";

export type GSESquawkStatus = "open" | "in_progress" | "resolved";

export interface GSEUnitStationRef {
  id: string;
  icao_code: string;
  name: string;
}

export interface GSEUnitListItem {
  id: string;
  name: string;
  equipment_type: GSEEquipmentType;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  year: number | null;
  station: GSEUnitStationRef | null;
  status: GSEUnitStatus;
  status_note: string | null;
  last_service_date: string | null;
  next_service_date: string | null;
  service_interval_days: number | null;
  hours_total: number;
  purchase_date: string | null;
  manufacturer: string | null;
  is_active: boolean;
  notes: string | null;
  open_squawk_count: number;
}

export interface GSEUnitListResponse {
  items: GSEUnitListItem[];
  total: number;
}

export interface GSEMaintenanceItemResponse {
  id: string;
  gse_unit_id: string;
  title: string;
  description: string | null;
  item_type: GSEMxItemType;
  interval_days: number | null;
  interval_hours: number | null;
  last_completed_date: string | null;
  last_completed_hours: number | null;
  due_date: string | null;
  due_hours: number | null;
  status: GSEMxStatus;
  is_recurring: boolean;
  is_active: boolean;
}

export interface GSEMaintenanceListResponse {
  items: GSEMaintenanceItemResponse[];
  total: number;
}

export interface GSESquawkResponse {
  id: string;
  gse_unit_id: string;
  description: string;
  reported_date: string;
  reported_by: UserRef | null;
  status: GSESquawkStatus;
  resolved_date: string | null;
  resolved_by: UserRef | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface GSESquawkListResponse {
  items: GSESquawkResponse[];
  total: number;
}

// Fuel (M2-M-25c backend) ---------------------------------------------------

export interface FuelTypeResponse {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export interface FuelTypeListResponse {
  items: FuelTypeResponse[];
  total: number;
}

export interface FuelSupplierResponse {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  sms_phone: string | null;
  email: string | null;
  cc_emails: string | null;
  account_number: string | null;
  billing_terms: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface FuelSupplierListResponse {
  items: FuelSupplierResponse[];
  total: number;
}

export interface FuelSupplierBaseResponse {
  id: string;
  supplier_id: string;
  supplier_name: string;
  base_code: string;
  fuel_type_id: string;
  fuel_type_code: string;
  fuel_type_label: string;
  price_per_gallon: number | null;
  is_contract_rate: boolean;
  effective_from: string | null;
  effective_to: string | null;
  is_default: boolean;
  notes: string | null;
  is_active: boolean;
}

export interface FuelSupplierBaseListResponse {
  items: FuelSupplierBaseResponse[];
  total: number;
}

// Fuel orders (M2-M-27b backend / M2-G-40 frontend) -------------------------

export type FuelOrderStatus =
  | "ordered"
  | "confirmed"
  | "fueled"
  | "discrepancy"
  | "cancelled";

export type FuelOrderCloseSource = "supplier" | "ramp" | "dispatch";

export interface FuelOrderSupplierRef {
  id: string;
  name: string;
}

export interface FuelOrderFuelTypeRef {
  id: string;
  code: string;
  label: string;
}

export interface FuelOrderResponse {
  id: string;
  n_number: string;
  base_code: string;
  requested_fuel_date: string;
  requested_fuel_time: string | null;
  supplier: FuelOrderSupplierRef;
  fuel_type: FuelOrderFuelTypeRef;
  supplier_name_snapshot: string;
  fuel_type_label_snapshot: string;
  price_per_gallon: number | null;
  requested_quantity_gallons: number;
  special_instructions: string | null;
  status: FuelOrderStatus;
  confirmed_at: string | null;
  confirmed_by_name: string | null;
  confirmed_note: string | null;
  fueled_at: string | null;
  fueled_by_name: string | null;
  actual_quantity_gallons: number | null;
  discrepancy_reason: string | null;
  closed_by_source: FuelOrderCloseSource | null;
  cancel_reason: string | null;
  invoice_pending: boolean;
  requested_by: UserRef;
  requested_at: string;
  notification_sent_at: string | null;
  notification_channel: string | null;
  notification_to: string | null;
  notification_subject: string | null;
}

export interface FuelOrderListResponse {
  items: FuelOrderResponse[];
  total: number;
}

export interface FuelOrderStatusLogEntry {
  id: string;
  from_status: FuelOrderStatus | null;
  to_status: FuelOrderStatus;
  actor: UserRef | null;
  actor_name: string | null;
  source: FuelOrderCloseSource | null;
  note: string | null;
  created_at: string;
}

export interface FuelOrderStatusLogResponse {
  items: FuelOrderStatusLogEntry[];
  total: number;
}

// Load Teams (M2-M-25d backend / M2-G-ramp-ops-redesign frontend)

export interface LoadTeamResponse {
  id: string;
  team_name: string;
  base_icao: string;
  team_lead: UserRef | null;
  color_code: string;
  is_active: boolean;
  notes: string | null;
  member_count: number;
}

export interface LoadTeamListResponse {
  items: LoadTeamResponse[];
  total: number;
}

// Settings — M2-M-28a / M2-G-46+47+53

export interface CompanyProfileResponse {
  id: string;
  legal_name: string | null;
  short_name: string | null;
  logo_url: string | null;
  street_line_1: string | null;
  street_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  main_phone: string | null;
  ops_phone: string | null;
  main_email: string | null;
  ops_email: string | null;
  part_135_certificate: string | null;
  fiscal_year_end: string | null; // ISO date (yyyy-mm-dd)
  notes: string | null;
}

export interface CompanyProfileUpdateRequest {
  legal_name?: string | null;
  short_name?: string | null;
  logo_url?: string | null;
  street_line_1?: string | null;
  street_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  main_phone?: string | null;
  ops_phone?: string | null;
  main_email?: string | null;
  ops_email?: string | null;
  part_135_certificate?: string | null;
  fiscal_year_end?: string | null;
  notes?: string | null;
}

export interface CompanyBaseResponse {
  id: string;
  icao: string;
  display_name: string;
  city: string | null;
  state: string | null;
  timezone: string | null;
  is_hub: boolean;
  is_active: boolean;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  notes: string | null;
}

export interface CompanyBaseListResponse {
  items: CompanyBaseResponse[];
  total: number;
}

export interface CompanyBaseCreateRequest {
  icao: string;
  display_name: string;
  city?: string | null;
  state?: string | null;
  timezone?: string | null;
  is_hub?: boolean;
  is_active?: boolean;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  notes?: string | null;
}

export interface CompanyBaseUpdateRequest {
  display_name?: string;
  city?: string | null;
  state?: string | null;
  timezone?: string | null;
  is_hub?: boolean;
  is_active?: boolean;
  manager_name?: string | null;
  manager_phone?: string | null;
  manager_email?: string | null;
  notes?: string | null;
}

export interface FlightTrackingConfigResponse {
  id: string;
  overdue_threshold_minutes: number;
  position_polling_seconds: number;
  simulation_mode_enabled: boolean;
  spider_tracks_aff_email: string | null;
  spider_tracks_aff_endpoint: string | null;
}

export interface FlightTrackingConfigUpdateRequest {
  overdue_threshold_minutes?: number;
  position_polling_seconds?: number;
  simulation_mode_enabled?: boolean;
  spider_tracks_aff_email?: string | null;
  spider_tracks_aff_endpoint?: string | null;
}

// Users + Permissions — M2-M-28b / M2-G-48

export interface UserResponse {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  roles: string[];
  has_password: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface UserListResponse {
  items: UserResponse[];
  total: number;
}

export interface UserCreateRequest {
  email: string;
  full_name: string;
  roles?: string[];
  password?: string | null;
  is_active?: boolean;
}

export interface UserUpdateRequest {
  full_name?: string;
  roles?: string[];
  is_active?: boolean;
}

export interface UserSetPasswordRequest {
  password: string;
}

export interface RoleSummary {
  id: string;
  label: string;
  description: string;
}

export interface RolesResponse {
  roles: RoleSummary[];
}

// Pilot Accept/Deny release (Spec 4 §"The 8 steps / 6").
// Backend in services/ops/app/routes/flight_pilot_acceptance.py
// (migration 0029).
export interface PilotAcceptanceResponse {
  id: string;
  flight_id: string;
  pilot_user_id: string;
  accepted: boolean;
  denied_reason: string | null;
  created_at: string;
}

export interface PilotAcceptanceRequest {
  accepted: boolean;
  denied_reason?: string;
}

// FRAT — Flight Risk Assessment Tool (Spec 4 §"The 8 steps / 4").
// Backend in services/ops/app/routes/frat.py (migration 0028).

export type FratRiskLevel = "low" | "medium" | "high" | "extreme";
export type FratAuthorizationKind =
  | "dispatch_contact"
  | "cp_do_authorization";

export interface FratAuthorizationResponse {
  id: string;
  frat_assessment_id: string;
  kind: FratAuthorizationKind;
  authorizer_name: string;
  authorizer_role: string;
  authorizer_cert_number: string | null;
  notes: string | null;
  authorized_at: string;
}

export interface FratAssessmentResponse {
  id: string;
  flight_id: string;
  pilot_user_id: string;
  answers: Record<string, number>;
  total_score: number;
  risk_level: FratRiskLevel;
  mitigations: string | null;
  created_at: string;
  authorizations: FratAuthorizationResponse[];
}

export interface FratSubmitRequest {
  answers: Record<string, number>;
  mitigations?: string;
}

export interface FratAuthorizeRequest {
  kind: FratAuthorizationKind;
  authorizer_name: string;
  authorizer_role: string;
  authorizer_cert_number?: string;
  notes?: string;
}

// 8-step preflight job flow (Spec 4 §"8-STEP PREFLIGHT JOB FLOW").
// Backend in services/ops/app/routes/preflight.py (migration 0027).
export interface StepCompletionResponse {
  id: string;
  flight_id: string;
  pilot_user_id: string;
  step_number: number;
  label: string;
  completed_at: string;
  payload: Record<string, unknown>;
}

export interface PreflightProgressResponse {
  flight_id: string;
  pilot_user_id: string;
  completed: StepCompletionResponse[];
  /** The lowest step_number not yet completed for this (flight, pilot).
   *  Null when all 8 are done. */
  next_step: number | null;
  total_steps: number;
}

export interface StepCompletionRequest {
  payload?: Record<string, unknown>;
}

// Pilot duty tracking (Spec 4 §"Duty time tracking" / M2 Duty backend).
export interface DutyPeriodSummary {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  elapsed_hours: number;
  is_open: boolean;
  rest_acknowledged: boolean;
}

export interface DutyWarning {
  level: "yellow" | "red";
  kind: "short_rest" | "max_duty" | "approaching";
  message: string;
}

export interface CurrentDutyResponse {
  open: DutyPeriodSummary | null;
  last_closed: DutyPeriodSummary | null;
  min_rest_hours: number;
  max_duty_hours: number;
  warnings: DutyWarning[];
}

export interface DutyHistoryResponse {
  items: DutyPeriodSummary[];
  total: number;
}

// Spec 5 Compliance / Currency
export type CurrencyStatus =
  | "not_started"
  | "upcoming"
  | "early_month"
  | "due_this_month"
  | "grace_month"
  | "non_current";

export type CurrencyIntervalType =
  | "annual"
  | "semi_annual"
  | "medical_hard_expiry"
  | "rolling_days";

export interface CurrencyItemRef {
  id: string;
  code: string;
  name: string;
  regulation: string;
  interval_type: CurrencyIntervalType;
  requires_examiner: boolean;
  is_check_event: boolean;
  is_initial_only: boolean;
  rolling_days: number | null;
  rolling_threshold: number | null;
  sort_order: number;
}

export interface PilotCurrencyCell {
  currency_item_id: string;
  status: CurrencyStatus;
  last_completed_date: string | null;
  base_month_due: string | null;
  grace_month_end: string | null;
  rolling_count: number | null;
}

export interface PilotComplianceRow {
  pilot: UserRef;
  overall_status: CurrencyStatus;
  cells: PilotCurrencyCell[];
}

export interface ComplianceChips {
  fully_current: number;
  early_month: number;
  grace_month: number;
  non_current: number;
}

export interface ComplianceBoardResponse {
  items: CurrencyItemRef[];
  rows: PilotComplianceRow[];
  chips: ComplianceChips;
}

export interface PilotProfileResponse {
  pilot: UserRef;
  overall_status: CurrencyStatus;
  cells: PilotCurrencyCell[];
  items: CurrencyItemRef[];
}

export interface LogCompletionRequest {
  pilot_user_id: string;
  currency_item_id: string;
  /** YYYY-MM-DD; server rejects future dates. */
  completion_date: string;
  completed_by: string;
  examiner_cert_number?: string | null;
  result?: "pass" | "fail" | null;
  score?: number | null;
  notes?: string | null;
  document_url?: string | null;
}

export interface LogCompletionResponse {
  completion_id: string;
  cell: PilotCurrencyCell;
}

export type PicDotColor = "green" | "yellow" | "red";

export interface ComplianceFinding {
  currency_item_id: string;
  code: string;
  name: string;
  regulation: string;
  status: CurrencyStatus;
  last_completed_date: string | null;
  grace_month_end: string | null;
  message: string;
}

export interface PicComplianceResponse {
  pilot: UserRef;
  dot_color: PicDotColor;
  hard_blocks: ComplianceFinding[];
  soft_warnings: ComplianceFinding[];
}

export interface OverrideRequest {
  pilot_user_id: string;
  currency_item_id: string;
  flight_id?: string | null;
  supervisor_cert_number: string;
  /** Spec 5: minimum 50 characters. */
  reason: string;
}

export interface OverrideResponse {
  id: string;
  pilot_user_id: string;
  currency_item_id: string;
  flight_id: string | null;
  supervisor_user_id: string;
  supervisor_cert_number: string;
  reason: string;
  created_at: string;
}

// Per-tenant Admin Access toggle (M2-X-1).
export interface AdminAccessRoleRow {
  id: string;
  label: string;
  description: string;
  /** Whether this role grants Admin portal visibility in this tenant. */
  admin_access: boolean;
}

export interface AdminAccessRolesResponse {
  roles: AdminAccessRoleRow[];
}

export interface AdminAccessToggleRequest {
  admin_access: boolean;
  /** Optional free-text reason captured in `admin_access_audit.reason`. */
  reason?: string;
}

// Village weather — M2-M-29 / M2-G-village-wx-redesign

export type CloudCover = "SKC" | "CLR" | "FEW" | "SCT" | "BKN" | "OVC" | "VV";

export interface VillageAirportResponse {
  id: string;
  icao: string;
  name: string;
  region: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface VillageAirportListResponse {
  items: VillageAirportResponse[];
  total: number;
}

export interface VillageAirportCreateRequest {
  icao: string;
  name: string;
  region?: string | null;
  notes?: string | null;
}

export interface VillageReporterRef {
  id: string;
  full_name: string;
}

export interface VillageWeatherReportResponse {
  id: string;
  village_airport_id: string;
  reported_by: VillageReporterRef | null;
  reported_by_name: string | null;
  reported_at: string;

  cloud_cover: CloudCover | null;
  ceiling_ft: number | null;
  visibility_sm: number | null;

  wind_dir_deg: number | null;
  wind_speed_kt: number | null;
  wind_gust_kt: number | null;

  temperature_c: number | null;
  altimeter_in_hg: number | null;

  notes: string | null;
  flight_category: FlightCategory | null;
}

export interface VillageWeatherReportListResponse {
  items: VillageWeatherReportResponse[];
  total: number;
}

export interface VillageWeatherReportCreateRequest {
  village_airport_id: string;
  reported_at?: string | null;
  cloud_cover?: CloudCover | null;
  ceiling_ft?: number | null;
  visibility_sm?: number | null;
  wind_dir_deg?: number | null;
  wind_speed_kt?: number | null;
  wind_gust_kt?: number | null;
  temperature_c?: number | null;
  altimeter_in_hg?: number | null;
  notes?: string | null;
}

export interface VillageBoardRow {
  airport: VillageAirportResponse;
  latest_report: VillageWeatherReportResponse | null;
}

export interface VillageBoardResponse {
  items: VillageBoardRow[];
  total: number;
}

// Flight × LoadTeam assignments — M2-M-25e / M2-G-25e-wire-flight-assignments

export interface FlightAssignmentFlightRef {
  id: string;
  flight_number: string;
  origin: string;
  destination: string;
  scheduled_departure_at: string;
  status: string;
}

export interface FlightAssignmentTeamRef {
  id: string;
  team_name: string;
  base_icao: string;
  color_code: string;
}

export interface FlightAssignmentResponse {
  id: string;
  flight: FlightAssignmentFlightRef;
  load_team: FlightAssignmentTeamRef;
  assigned_by: UserRef | null;
  assigned_at: string;
  cleared_at: string | null;
  cleared_by: UserRef | null;
  note: string | null;
}

export interface FlightAssignmentListResponse {
  items: FlightAssignmentResponse[];
  total: number;
}

export interface FlightAssignmentCreateRequest {
  flight_id: string;
  load_team_id: string;
  note?: string | null;
}

// Per-tenant SSO providers — M2-M-28c / M2-G-settings-sso-admin

export type SsoProviderId = "google" | "microsoft-entra-id" | "okta";

export interface TenantSsoProviderResponse {
  id: string;
  provider_id: SsoProviderId;
  display_name: string | null;
  client_id: string | null;
  has_secret: boolean;
  extra_config: Record<string, string | number | boolean | null> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantSsoProviderListResponse {
  items: TenantSsoProviderResponse[];
  total: number;
}

export interface TenantSsoProviderUpsertRequest {
  display_name?: string | null;
  client_id?: string | null;
  // Special handling: omit → keep existing; "" → clear; value → overwrite.
  client_secret?: string | null;
  extra_config?: Record<string, string | number | boolean | null> | null;
  is_active?: boolean;
}

export interface ProviderCatalogEntry {
  id: SsoProviderId;
  label: string;
}

export interface ProviderCatalogResponse {
  providers: ProviderCatalogEntry[];
}

// Email-first SSO resolution at login (M2 — SSO end-to-end)

export interface SsoResolveProvider {
  id: SsoProviderId;
  label: string;
  display_name: string | null;
}

export interface SsoResolveResponse {
  tenant_id: string | null;
  providers: SsoResolveProvider[];
}

// Fuel quality test log — M2-M-30 / M2-G-fuel-quality-log

export type FuelQualityTestKind =
  | "sump"
  | "supplier_bulk"
  | "tank_calibration"
  | "other";

export type FuelQualityResult =
  | "pass"
  | "fail"
  | "contamination_water"
  | "contamination_particulate";

export interface FuelTypeRef {
  id: string;
  code: string;
  label: string;
}

export interface FuelQualityTestResponse {
  id: string;
  base_code: string;
  n_number: string | null;
  fuel_type: FuelTypeRef | null;
  fuel_type_label_snapshot: string | null;
  test_kind: FuelQualityTestKind;
  water_detected: boolean;
  particulates_detected: boolean;
  result: FuelQualityResult;
  sample_volume_oz: number | null;
  ambient_temp_c: number | null;
  notes: string | null;
  tested_at: string;
  tested_by: UserRef | null;
  tested_by_name: string | null;
  created_at: string;
}

export interface FuelQualityTestListResponse {
  items: FuelQualityTestResponse[];
  total: number;
}

export interface FuelQualityTestCreateRequest {
  base_code: string;
  n_number?: string | null;
  fuel_type_id?: string | null;
  test_kind?: FuelQualityTestKind;
  water_detected?: boolean;
  particulates_detected?: boolean;
  sample_volume_oz?: number | null;
  ambient_temp_c?: number | null;
  notes?: string | null;
  tested_at?: string | null;
}

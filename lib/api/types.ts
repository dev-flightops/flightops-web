/**
 * TypeScript mirrors of the Pydantic schemas in services/ops/app/schemas.py.
 * Hand-maintained for now; we'll generate from OpenAPI in a later story.
 */

export type FlightStatus = "scheduled" | "released" | "cancelled" | "completed";

export interface AircraftRef {
  id: string;
  tail_number: string;
  model: string;
  seats: number;
}

export interface AircraftListItem {
  id: string;
  tail_number: string;
  model: string;
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

export interface FlightLogResponse {
  id: string;
  log_number: string;          // LOG-YYYYMMDD-HHMMSS
  aircraft: AircraftRef;
  flight_id: string | null;
  flight_number: string | null;
  flight_type: FlightType;
  flight_date: string;         // YYYY-MM-DD
  status: FlightLogStatus;
  created_by: UserRef;
  created_at: string;          // ISO 8601 UTC
}

export interface FlightLogListResponse {
  items: FlightLogResponse[];
  total: number;
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
  model: string;
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
  model: string;
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

export interface StationListItem {
  id: string;
  icao_code: string;
  name: string;
  city: string | null;
  state: string | null;
  elevation_ft: number | null;
  has_reporting_function: boolean;
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

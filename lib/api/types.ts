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

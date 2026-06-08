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

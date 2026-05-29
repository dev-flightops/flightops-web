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

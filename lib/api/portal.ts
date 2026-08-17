/**
 * Customer portal API — wraps reservations-service /portal/*.
 *
 *   GET /reservations/portal/charters        the caller's own charters
 *   GET /reservations/portal/charters/{id}   one of them
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

/** Cents → "$1,234.56". Null quote renders as a dash upstream. */
export function formatQuote(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

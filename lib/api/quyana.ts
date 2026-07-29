/**
 * Quyana Rewards API — wraps reservations-service /quyana/*
 * (flightops-services PR #119).
 *
 *   GET  /reservations/quyana                       list (?tier=)
 *   POST /reservations/quyana                       enroll a customer
 *   GET  /reservations/quyana/{id}                  detail + transactions
 *   POST /reservations/quyana/{id}/transactions    ledger update
 *
 * Tier ladder (backend enforces on lifetime_points):
 *   standard (0) → silver (5k) → gold (15k) → elite (40k)
 *
 * Transaction types:
 *   earn_flight / earn_bonus  (positive, add to lifetime + balance)
 *   adjustment                 (signed; positive contributes to lifetime)
 *   redeem / expire            (negative or positive, balance-only)
 */

import { apiFetch } from "./client";

export type QuyanaTier = "standard" | "silver" | "gold" | "elite";

export const QUYANA_TIERS: readonly QuyanaTier[] = [
  "standard",
  "silver",
  "gold",
  "elite",
];

export const QUYANA_TIER_LABELS: Record<QuyanaTier, string> = {
  standard: "Standard",
  silver: "Silver",
  gold: "Gold",
  elite: "Elite",
};

export type QuyanaTransactionType =
  | "earn_flight"
  | "earn_bonus"
  | "redeem"
  | "expire"
  | "adjustment";

export const QUYANA_TRANSACTION_TYPES: readonly QuyanaTransactionType[] = [
  "earn_flight",
  "earn_bonus",
  "redeem",
  "expire",
  "adjustment",
];

export const QUYANA_TRANSACTION_TYPE_LABELS: Record<
  QuyanaTransactionType,
  string
> = {
  earn_flight: "Flight Earn",
  earn_bonus: "Bonus Earn",
  redeem: "Redemption",
  expire: "Expiry",
  adjustment: "Manual Adjustment",
};

export interface QuyanaMemberRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  member_number: string;
  enrollment_date: string; // YYYY-MM-DD
  enrolled_station: string | null;
  tier: QuyanaTier;
  points_balance: number;
  lifetime_points: number;
  is_active: boolean;
  notes: string | null;
}

export interface QuyanaTransactionRow {
  id: string;
  member_id: string;
  transaction_type: QuyanaTransactionType;
  points: number;
  description: string | null;
  created_at: string; // ISO 8601
}

export interface QuyanaMemberListResponse {
  items: QuyanaMemberRow[];
}

export interface QuyanaMemberDetailResponse {
  member: QuyanaMemberRow;
  transactions: QuyanaTransactionRow[];
}

export interface QuyanaEnrollRequest {
  customer_id: string;
  enrolled_station?: string;
  notes?: string;
}

export interface QuyanaTransactionCreateRequest {
  transaction_type: QuyanaTransactionType;
  points: number;
  description?: string;
}

export async function listQuyanaMembers(
  params: { tier?: QuyanaTier; include_inactive?: boolean } = {},
): Promise<QuyanaMemberListResponse> {
  const qs = new URLSearchParams();
  if (params.tier) qs.set("tier", params.tier);
  if (params.include_inactive) qs.set("include_inactive", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<QuyanaMemberListResponse>(`/reservations/quyana${suffix}`);
}

export async function enrollQuyanaMember(
  body: QuyanaEnrollRequest,
): Promise<QuyanaMemberRow> {
  return apiFetch<QuyanaMemberRow>("/reservations/quyana", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getQuyanaMember(
  memberId: string,
): Promise<QuyanaMemberDetailResponse> {
  return apiFetch<QuyanaMemberDetailResponse>(
    `/reservations/quyana/${memberId}`,
  );
}

export async function createQuyanaTransaction(
  memberId: string,
  body: QuyanaTransactionCreateRequest,
): Promise<QuyanaMemberRow> {
  return apiFetch<QuyanaMemberRow>(
    `/reservations/quyana/${memberId}/transactions`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

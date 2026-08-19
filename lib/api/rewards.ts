/**
 * Rewards program API — wraps the reservations-service /rewards/*
 * endpoints.
 *
 * "Rewards" is the product concept. What each operator CALLS their
 * program is per-tenant data, read from
 * company_profile.rewards_program_name — so nothing in this file, or
 * any type it exports, should be named after one operator's branding.
 *
 *   GET  /reservations/rewards                       list (?tier=)
 *   POST /reservations/rewards                       enroll a customer
 *   GET  /reservations/rewards/{id}                  detail + transactions
 *   POST /reservations/rewards/{id}/transactions    ledger update
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

export type RewardsTier = "standard" | "silver" | "gold" | "elite";

export const QUYANA_TIERS: readonly RewardsTier[] = [
  "standard",
  "silver",
  "gold",
  "elite",
];

export const QUYANA_TIER_LABELS: Record<RewardsTier, string> = {
  standard: "Standard",
  silver: "Silver",
  gold: "Gold",
  elite: "Elite",
};

export type RewardsTransactionType =
  | "earn_flight"
  | "earn_bonus"
  | "redeem"
  | "expire"
  | "adjustment";

export const QUYANA_TRANSACTION_TYPES: readonly RewardsTransactionType[] = [
  "earn_flight",
  "earn_bonus",
  "redeem",
  "expire",
  "adjustment",
];

export const QUYANA_TRANSACTION_TYPE_LABELS: Record<
  RewardsTransactionType,
  string
> = {
  earn_flight: "Flight Earn",
  earn_bonus: "Bonus Earn",
  redeem: "Redemption",
  expire: "Expiry",
  adjustment: "Manual Adjustment",
};

export interface RewardsMemberRow {
  id: string;
  customer_id: string;
  customer_name: string | null;
  member_number: string;
  enrollment_date: string; // YYYY-MM-DD
  enrolled_station: string | null;
  tier: RewardsTier;
  points_balance: number;
  lifetime_points: number;
  is_active: boolean;
  notes: string | null;
}

export interface RewardsTransactionRow {
  id: string;
  member_id: string;
  transaction_type: RewardsTransactionType;
  points: number;
  description: string | null;
  created_at: string; // ISO 8601
}

export interface RewardsMemberListResponse {
  items: RewardsMemberRow[];
}

export interface RewardsMemberDetailResponse {
  member: RewardsMemberRow;
  transactions: RewardsTransactionRow[];
}

export interface RewardsEnrollRequest {
  customer_id: string;
  enrolled_station?: string;
  notes?: string;
}

export interface RewardsTransactionCreateRequest {
  transaction_type: RewardsTransactionType;
  points: number;
  description?: string;
}

export async function listRewardsMembers(
  params: { tier?: RewardsTier; include_inactive?: boolean } = {},
): Promise<RewardsMemberListResponse> {
  const qs = new URLSearchParams();
  if (params.tier) qs.set("tier", params.tier);
  if (params.include_inactive) qs.set("include_inactive", "true");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<RewardsMemberListResponse>(`/reservations/rewards${suffix}`);
}

export async function enrollRewardsMember(
  body: RewardsEnrollRequest,
): Promise<RewardsMemberRow> {
  return apiFetch<RewardsMemberRow>("/reservations/rewards", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getRewardsMember(
  memberId: string,
): Promise<RewardsMemberDetailResponse> {
  return apiFetch<RewardsMemberDetailResponse>(
    `/reservations/rewards/${memberId}`,
  );
}

export async function createRewardsTransaction(
  memberId: string,
  body: RewardsTransactionCreateRequest,
): Promise<RewardsMemberRow> {
  return apiFetch<RewardsMemberRow>(
    `/reservations/rewards/${memberId}/transactions`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

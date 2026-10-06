/**
 * Type qualifications — wraps ops-service /compliance/type-qualifications
 * (flightops-services#268, flightops-ops#45).
 *
 *   GET  /ops/compliance/type-qualifications?station=          every pilot
 *   GET  /ops/compliance/type-qualifications/{userId}          one pilot, with history
 *   POST /ops/compliance/type-qualifications/{userId}/positions authorise a position
 *   POST /ops/compliance/type-qualifications/positions/{id}/revoke
 *
 * The operator's 135ACM grid: aircraft type × PIC, SIC, Instructor, Check
 * Airman, Advisory Pilot. A position is current while the checks on its
 * type are in date — a competency check within 12 calendar months, and
 * for the PIC an instrument check within 6. A check ride is an ordinary
 * currency completion that names the type (`logCurrencyCompletion` with
 * `airframe_type`), so one check moves the currency board and the type.
 *
 * Labels and colours live with the pages, in
 * app/(app)/compliance/type-qualifications/display.ts.
 */

import { apiFetch } from "./client";
import type { CurrencyStatus, TypePosition, UserRef } from "./types";

export type { TypePosition };

export type TypeCheck = "competency" | "instrument";

export type TypeCellState = "current" | "grace" | "non_current" | "not_authorised";

export interface TypeCheckStanding {
  check: TypeCheck;
  status: CurrencyStatus;
  last_on: string | null;
  base_month_due: string | null;
  grace_month_end: string | null;
}

export interface TypeQualificationCell {
  airframe_type: string;
  position: TypePosition;
  state: TypeCellState;
  qualification_id: string | null;
  authorised_on: string | null;
  checks: TypeCheckStanding[];
}

export interface TypeQualificationPilot {
  pilot: UserRef;
  station: string | null;
  cells: TypeQualificationCell[];
}

export interface TypeCheckItems {
  competency: string | null;
  instrument: string | null;
}

export interface TypeQualificationGrid {
  airframe_types: string[];
  positions: TypePosition[];
  check_items: TypeCheckItems;
  pilots: TypeQualificationPilot[];
}

export interface TypeQualificationRecord {
  id: string;
  airframe_type: string;
  position: TypePosition;
  authorised_on: string;
  authorised_by: UserRef | null;
  revoked_on: string | null;
  revoked_by: UserRef | null;
  notes: string | null;
}

export interface TypeCheckRecord {
  completion_id: string;
  airframe_type: string;
  check: TypeCheck;
  completion_date: string;
  result: "pass" | "fail" | null;
  completed_by: string;
  examiner_cert_number: string | null;
  notes: string | null;
}

export interface PilotTypeQualifications {
  pilot: TypeQualificationPilot;
  airframe_types: string[];
  positions: TypePosition[];
  check_items: TypeCheckItems;
  authorisations: TypeQualificationRecord[];
  checks: TypeCheckRecord[];
}

export async function getTypeQualificationGrid(
  station?: string | null,
): Promise<TypeQualificationGrid> {
  const qs = station ? `?${new URLSearchParams({ station }).toString()}` : "";
  return apiFetch<TypeQualificationGrid>(`/ops/compliance/type-qualifications${qs}`);
}

export async function getPilotTypeQualifications(
  userId: string,
): Promise<PilotTypeQualifications> {
  return apiFetch<PilotTypeQualifications>(`/ops/compliance/type-qualifications/${userId}`);
}

export async function authoriseTypePosition(
  userId: string,
  body: { airframe_type: string; position: TypePosition; authorised_on: string; notes: string | null },
): Promise<TypeQualificationRecord> {
  return apiFetch<TypeQualificationRecord>(
    `/ops/compliance/type-qualifications/${userId}/positions`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function revokeTypePosition(
  qualificationId: string,
  body: { revoked_on: string; notes: string | null },
): Promise<TypeQualificationRecord> {
  return apiFetch<TypeQualificationRecord>(
    `/ops/compliance/type-qualifications/positions/${qualificationId}/revoke`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

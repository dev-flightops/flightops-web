import type { CrewSeat } from "@/lib/api/ops";
import type { ComplianceFinding, PicComplianceResponse } from "@/lib/api/types";

/**
 * Server-safe helpers for the soft-warning ack state that lives in
 * the URL (`?warns_acked=code1,code2`). Split out of the "use client"
 * SoftWarningAckList module so the server-side page loader can call
 * them without tripping Next.js's client/server boundary check.
 *
 * `parseAckedWarns` runs on the server as part of page rendering;
 * `allSoftAcked` is used by the client component + the page-level
 * hardBlockReason computation.
 */

export function parseAckedWarns(
  param: string | string[] | undefined,
): Set<string> {
  if (!param) return new Set();
  const raw = Array.isArray(param) ? param[0] : param;
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function allSoftAcked(
  findings: ComplianceFinding[],
  ackedCodes: ReadonlySet<string>,
): boolean {
  return findings.every((f) => ackedCodes.has(f.code));
}

/** How an acknowledged warning is named in `?warns_acked=` and in the
 *  release request: the item code for the PIC, "sic:<code>" for the
 *  SIC. Many items apply to either seat (a medical), so the seat keeps
 *  one pilot's acknowledgement from standing in for another's. */
export function warningAckKey(seat: CrewSeat, code: string): string {
  return seat === "pic" ? code : `${seat}:${code}`;
}

export interface SeatCompliance {
  seat: CrewSeat;
  compliance: PicComplianceResponse;
}

/** Every soft warning on the flight deck, with its ack key, in seat
 *  order. Soft warnings need acknowledging whatever the dot colour: a
 *  PIC released on a supervisor override still has them. */
export function seatWarnings(
  checks: SeatCompliance[],
): { seat: CrewSeat; key: string; finding: ComplianceFinding }[] {
  return checks.flatMap(({ seat, compliance }) =>
    compliance.soft_warnings.map((finding) => ({
      seat,
      key: warningAckKey(seat, finding.code),
      finding,
    })),
  );
}

/** A finding's message without the item name in front of it. The page
 *  prints the name first; the backend used to repeat it in the message
 *  ("SIC IFR Currency (…) — SIC IFR Currency — 0 of 6"). */
export function findingMessage(finding: ComplianceFinding): string {
  const prefix = `${finding.name} — `;
  return finding.message.startsWith(prefix)
    ? finding.message.slice(prefix.length)
    : finding.message;
}

/** What a finding is about, as a stable key: its currency item, or the
 *  aircraft type of a type finding (#46), which has no item. The same
 *  key the service matches an override on. */
export function findingKey(finding: ComplianceFinding): string {
  return finding.airframe_type
    ? `type:${finding.airframe_type}`
    : `item:${finding.currency_item_id}`;
}

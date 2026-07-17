import type { ComplianceFinding } from "@/lib/api/types";

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

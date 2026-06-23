import type {
  CurrencyItemRef,
  PilotCurrencyCell,
  UserRef,
} from "@/lib/api/types";

import type { StatusToken } from "../../crew-currency/status-tokens";
import type { CurrencyStatus } from "../../crew-currency/types";

/**
 * Pilot header card — Spec 5 §"Currency profile page / Header".
 *
 * MVP carries: full name, email, overall-status badge, overall
 * compliance percentage (current vs total items), counts by bucket
 * (early/grace/non-current).
 *
 * Deferred (need data from outside the compliance API):
 *   - Pilot photo / initials avatar
 *   - FAA certificate number (on `User` once SSO ships in M2-M-17)
 *   - Base (waiting on `user.base` field)
 *   - Total flight hours + last flight date (needs elog auto-fire)
 */
export function ProfileHeader({
  pilot,
  overallToken,
  overallStatus,
  cells,
  items: _items,
}: {
  pilot: UserRef;
  overallToken: StatusToken;
  overallStatus: CurrencyStatus;
  cells: PilotCurrencyCell[];
  items: CurrencyItemRef[];
}) {
  const stats = summarizeBuckets(cells);
  const compliancePct = computeCompliancePercent(cells);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {pilot.full_name}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">{pilot.email}</p>
        </div>
        <span className={overallToken.badge}>{overallToken.label}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Compliance" value={`${compliancePct}%`} accent={complianceAccent(overallStatus)} />
        <Stat label="Early" value={stats.early_month} accent="text-status-teal" />
        <Stat label="Grace" value={stats.grace_month} accent="text-status-yellow" />
        <Stat label="Non-Current" value={stats.non_current} accent="text-status-red" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-center">
      <div className={`text-lg font-bold ${accent}`}>{value}</div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

interface BucketSummary {
  early_month: number;
  grace_month: number;
  non_current: number;
  current: number;
  not_started: number;
}

function summarizeBuckets(cells: PilotCurrencyCell[]): BucketSummary {
  const out: BucketSummary = {
    early_month: 0,
    grace_month: 0,
    non_current: 0,
    current: 0,
    not_started: 0,
  };
  for (const cell of cells) {
    if (cell.status === "early_month") out.early_month++;
    else if (cell.status === "grace_month") out.grace_month++;
    else if (cell.status === "non_current") out.non_current++;
    else if (cell.status === "not_started") out.not_started++;
    else out.current++;
  }
  return out;
}

function computeCompliancePercent(cells: PilotCurrencyCell[]): number {
  if (cells.length === 0) return 0;
  // Count anything other than non_current + not_started as "legally
  // current". Grace counts as current per Spec 5 (it's a valid
  // operational window, not a violation).
  const compliant = cells.filter(
    (c) => c.status !== "non_current" && c.status !== "not_started",
  ).length;
  return Math.round((compliant / cells.length) * 100);
}

function complianceAccent(status: CurrencyStatus): string {
  if (status === "non_current") return "text-status-red";
  if (status === "grace_month") return "text-status-yellow";
  if (status === "not_started") return "text-muted-foreground";
  return "text-status-green";
}

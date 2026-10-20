import { PageHeader } from "@/components/ff/page-header";
import { Stat, StatStrip, type StatTone } from "@/components/ff/stat-strip";
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
    <>
      <PageHeader
        back={{ href: "/compliance/crew-currency", label: "Back to compliance board" }}
        eyebrow="Pilot"
        title={pilot.full_name}
        description={pilot.email}
        actions={<span className={overallToken.badge}>{overallToken.label}</span>}
      />
      <StatStrip label="Currency summary">
        <Stat label="Compliance" value={`${compliancePct}%`} tone={complianceTone(overallStatus)} />
        <Stat label="Early" value={stats.early_month} tone="teal" />
        <Stat label="Grace" value={stats.grace_month} tone="yellow" />
        <Stat label="Non-Current" value={stats.non_current} tone="red" />
      </StatStrip>
    </>
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

function complianceTone(status: CurrencyStatus): StatTone {
  if (status === "non_current") return "red";
  if (status === "grace_month") return "yellow";
  if (status === "not_started") return "neutral";
  return "green";
}

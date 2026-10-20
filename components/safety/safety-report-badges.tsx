import {
  RISK_LEVEL_LABELS,
  SAFETY_REPORT_STATUS_LABELS,
  type RiskLevel,
  type SafetyReportStatus,
} from "@/lib/api/safety-reports";

/**
 * Legacy's safety report badges: open yellow, closed green, anything in
 * between blue; risk red at 15+, yellow at 8+, green below. Shared by
 * the inbox, the report page and My Reports.
 */

const BADGE = "status-mark text-[0.65rem]";

const TONE = {
  red: "text-status-red",
  yellow: "text-status-yellow",
  green: "text-status-green",
  blue: "text-status-blue",
} as const;

const RISK_TONE: Record<RiskLevel, keyof typeof TONE> = { high: "red", medium: "yellow", low: "green" };

export function StatusBadge({ status }: { status: SafetyReportStatus }) {
  const tone = status === "open" ? "yellow" : status === "closed" ? "green" : "blue";
  return <span className={`${BADGE} ${TONE[tone]}`}>{SAFETY_REPORT_STATUS_LABELS[status]}</span>;
}

/** The score, or a dash before severity and likelihood are both set. */
export function RiskBadge({
  score,
  level,
  long = false,
}: {
  score: number | null;
  level: RiskLevel | null;
  /** "High Risk · 16" rather than "16", for the report's own page. */
  long?: boolean;
}) {
  if (score === null || level === null) {
    return long ? null : <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className={`${BADGE} ${TONE[RISK_TONE[level]]} tabular-nums`} title={RISK_LEVEL_LABELS[level]}>
      {long ? `${RISK_LEVEL_LABELS[level]} · ${score}` : score}
    </span>
  );
}

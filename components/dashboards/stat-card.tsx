import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
}

// Tone styles the value text — the legacy uses subtle color cues on stat
// cards (green for "OK", yellow for "watch", red for "issue").
const TONE_STYLES: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-status-green",
  warning: "text-status-yellow",
  destructive: "text-status-red",
};

// Mirrors the legacy `.stat-card`:
//   - rounded-xl panel (12px corners)
//   - tabular-nums numeric, centered text
//   - tiny uppercase label below the value
// Numeric value is rendered with the mono font so digits align nicely across
// multiple stat cards in a row.
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      {icon && (
        <div
          className={cn(
            "mx-auto mb-2 inline-flex h-5 w-5",
            TONE_STYLES[tone],
          )}
        >
          {icon}
        </div>
      )}
      <p
        className={cn(
          "font-mono text-[1.75rem] font-bold leading-tight tabular-nums",
          TONE_STYLES[tone],
        )}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      {hint && (
        <p className="mt-1 text-[0.7rem] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

import Link from "next/link";
import { AlertOctagon, AlertTriangle, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Compact vertical list of operational alerts. Ported from the legacy
 * `alert_list` macro: each row is a colored left-border + icon + message
 * + optional CTA link, severity drives the tint:
 *
 *   ▌🚨 OVERDUE: GV205 PADU→PANC, no contact 45 min        details →
 *   ▌⚠ Crew expired: 1 PIC out of compliance               crew →
 *   ▌ℹ NOTAM updated for PAEM                                read →
 *
 * In M1 the call sites pass static demo data; once the alerts service
 * lands in M2-M3, the same component renders real alert rows pulled
 * from the backend.
 */

export type AlertSeverity = "critical" | "warning" | "info";

export interface AlertItem {
  severity: AlertSeverity;
  message: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
}

const SEVERITY_STYLES: Record<
  AlertSeverity,
  { wrap: string; iconTone: string; icon: typeof AlertOctagon }
> = {
  critical: {
    wrap: "border-l-status-red bg-status-red/[0.08]",
    iconTone: "text-status-red",
    icon: AlertOctagon,
  },
  warning: {
    wrap: "border-l-status-orange bg-status-orange/[0.06]",
    iconTone: "text-status-orange",
    icon: AlertTriangle,
  },
  info: {
    wrap: "border-l-status-blue bg-status-blue/[0.06]",
    iconTone: "text-status-blue",
    icon: Info,
  },
};

export function AlertList({
  alerts,
  max = 10,
  emptyHint = "No active alerts.",
}: {
  alerts: AlertItem[];
  max?: number;
  emptyHint?: string;
}) {
  if (alerts.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground/70">
        {emptyHint}
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {alerts.slice(0, max).map((alert, idx) => {
        const style = SEVERITY_STYLES[alert.severity];
        const Icon = style.icon;
        return (
          <li
            key={idx}
            className={cn(
              "flex items-start gap-2 rounded-md border-l-[3px] px-3 py-2 text-xs",
              style.wrap,
            )}
          >
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 flex-shrink-0", style.iconTone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-foreground/90">{alert.message}</p>
              {alert.detail && (
                <p className="mt-0.5 text-[0.7rem] text-muted-foreground/80">
                  {alert.detail}
                </p>
              )}
            </div>
            {alert.href && (
              <Link
                href={alert.href}
                className="flex-shrink-0 text-[0.7rem] font-medium text-status-blue hover:underline"
              >
                {alert.linkLabel ?? "details →"}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

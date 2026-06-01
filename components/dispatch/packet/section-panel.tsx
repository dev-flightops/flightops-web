import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Mirrors the legacy `.panel` + `.section-title` pattern used throughout
 * `dispatch-platform-main/templates/dispatch/form.html`:
 *
 *   <div class="panel mb-4">                          ← rounded-xl border bg-card p-5
 *     <p class="section-title mb-3">Flight Details</p> ← tiny uppercase eyebrow
 *     ...content...
 *   </div>
 *
 * `accent` adds a colored left border (legacy uses this for "Load from
 * Schedule" with the iOS-blue accent). `tone` lets disabled / informational
 * panels mute the title color the same way the legacy does inline.
 */

export interface SectionPanelProps {
  title?: ReactNode;
  /** Right-aligned slot in the title row — usually a link or button. */
  titleAction?: ReactNode;
  /** Add a colored left border to the panel. */
  accent?: "blue" | "yellow" | "purple";
  /** Mute the title color (default keeps the standard muted-foreground). */
  titleColor?: "default" | "blue" | "yellow" | "red";
  className?: string;
  children: ReactNode;
}

const ACCENT_BORDER: Record<NonNullable<SectionPanelProps["accent"]>, string> = {
  blue: "border-l-[3px] border-l-status-blue",
  yellow: "border-l-[3px] border-l-status-yellow",
  purple: "border-l-[3px] border-l-status-purple",
};

const TITLE_TONE: Record<NonNullable<SectionPanelProps["titleColor"]>, string> = {
  default: "text-muted-foreground",
  blue: "text-status-blue",
  yellow: "text-status-yellow",
  red: "text-status-red",
};

export function SectionPanel({
  title,
  titleAction,
  accent,
  titleColor = "default",
  className,
  children,
}: SectionPanelProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        accent && ACCENT_BORDER[accent],
        className,
      )}
    >
      {(title || titleAction) && (
        <div className="mb-3 flex items-center justify-between">
          {title && (
            <p
              className={cn(
                "m-0 text-[0.65rem] font-bold uppercase tracking-[0.1em]",
                TITLE_TONE[titleColor],
              )}
            >
              {title}
            </p>
          )}
          {titleAction}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Common shape for a panel that doesn't have its underlying service yet.
 * Renders the SectionPanel with a muted-foreground hint inside, plus a
 * milestone tag so users can see where each piece is coming from.
 */
export function DisabledPanel({
  title,
  milestone,
  hint,
  accent,
  className,
}: {
  title: ReactNode;
  /** "M2" / "M3" / "M4" — controls the tag pill at the right. */
  milestone: "M2" | "M3" | "M4";
  hint: ReactNode;
  accent?: SectionPanelProps["accent"];
  className?: string;
}) {
  return (
    <SectionPanel
      title={title}
      accent={accent}
      className={className}
      titleAction={
        <span
          className="rounded-md bg-muted px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.06em] text-muted-foreground"
          title={`Coming in ${milestone}`}
        >
          {milestone}
        </span>
      }
    >
      <p className="text-xs text-muted-foreground">{hint}</p>
    </SectionPanel>
  );
}

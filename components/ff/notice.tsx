import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A message on the page (#79): a 3px edge in the status colour, a faint
 * ground of the same, an optional capitals label, and the text in the
 * page's own colour so it reads at full contrast. It replaces the boxes of
 * coloured text on a coloured tint. Errors announce themselves
 * (`role="alert"`); the others are status.
 */
export type NoticeTone = "red" | "yellow" | "green" | "blue" | "gray";

export function Notice({
  tone = "blue",
  label,
  children,
  className,
}: {
  tone?: NoticeTone;
  /** A word or two before the message: "Not released", "Saved". */
  label?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cn("notice", `notice-${tone}`, className)}>
      {label ? <span className="notice-label">{label}</span> : null}
      {children}
    </div>
  );
}

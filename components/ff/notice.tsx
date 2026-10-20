import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A message on the page (#79): a 3px edge in the status colour, a faint
 * ground of the same, an optional capitals label, and the text in the
 * page's own colour so it reads at full contrast. It replaces the boxes of
 * coloured text on a coloured tint. An error announces itself
 * (`role="alert"`); a notice that appears in answer to something the user
 * did can say so with `role="status"`; a standing note needs no role.
 */
export type NoticeTone = "red" | "yellow" | "green" | "blue" | "gray";

export function Notice({
  tone = "blue",
  label,
  children,
  className,
  role,
}: {
  tone?: NoticeTone;
  /** A word or two before the message: "Not released", "Saved". */
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Defaults to "alert" for red, none otherwise. */
  role?: "alert" | "status";
}) {
  return (
    <div role={role ?? (tone === "red" ? "alert" : undefined)} className={cn("notice", `notice-${tone}`, className)}>
      {label ? <span className="notice-label">{label}</span> : null}
      {children}
    </div>
  );
}

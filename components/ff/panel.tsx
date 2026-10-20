import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A titled section of a page (#79): one quiet 1px frame, the title in
 * small tracked capitals with its actions on the same line, the content
 * under a rule. It replaces the padded, rounded, shadowed cards: one level
 * of framing, nothing floating. A list inside a panel runs edge to edge
 * (`flush`), the way ForeFlight's tables sit in their sections.
 */
export function Panel({
  title,
  actions,
  children,
  className,
  flush = false,
  id,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding: for a table or a list of rows. */
  flush?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          {title ? <h2 className="panel-title">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={flush ? undefined : "p-5"}>{children}</div>
    </section>
  );
}

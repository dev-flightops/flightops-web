import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Nothing to show (#79): one plain sentence saying so and, when there is
 * one, the action that would change it. No illustration.
 */
export function EmptyState({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-5 py-8", className)}>
      <p className="text-sm text-muted-foreground">{children}</p>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

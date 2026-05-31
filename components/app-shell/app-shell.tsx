import Link from "next/link";
import { type ReactNode } from "react";

import { DepartmentNav } from "./department-nav";

/**
 * Two-row app chrome matching the legacy `dispatch-platform-main` base.html
 * exactly:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  Peregrine Flight Ops                  🔔 ✨ Clock 👥 ⭐ ❔ G… ⚙ Sign out │
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │  🏠 ▸  Dispatch  Dashboards  Flight Following ...                │
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * Legacy has NO top-row primary nav — just brand + right-cluster. The
 * department sub-nav row is context-aware via the current path.
 *
 * `actionsSlot` is the right-side cluster (`HeaderActions`) — passed as a
 * slot so the parent layout can wire the session-aware bits without
 * AppShell needing to know about auth shape.
 */
export interface AppShellProps {
  children: ReactNode;
  /** Brand text — usually the tenant company name. Falls back if absent. */
  brand?: string;
  actionsSlot?: ReactNode;
}

export function AppShell({
  children,
  brand = "Peregrine Flight Ops",
  actionsSlot,
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
        <div className="flex h-[50px] items-center justify-between px-4 sm:px-5">
          {/* Left: brand — links to /home to match legacy. */}
          <div className="flex min-w-0 flex-shrink-0 items-center gap-1 overflow-hidden">
            <Link
              href="/home"
              className="mr-3 flex flex-shrink-0 items-center gap-2"
            >
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {brand}
              </span>
            </Link>
          </div>

          {/* Right: notifications + AI + clock + users + owner + help + user + settings + sign out */}
          {actionsSlot}
        </div>

        <DepartmentNav />
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

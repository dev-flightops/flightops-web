import { type ReactNode } from "react";

import { AppShellHeader } from "./app-shell-header";

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
  /** Session roles — drives which department modules appear in the nav. */
  roles?: readonly string[];
}

export function AppShell({
  children,
  brand = "Peregrine Flight Ops",
  actionsSlot,
  roles = [],
}: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* AppShellHeader hides itself on /home so that page can render its
       *  own light-themed HomeTopBar for the pitch skin. Every other
       *  route keeps the standard dark Peregrine chrome. */}
      <AppShellHeader brand={brand} actionsSlot={actionsSlot} roles={roles} />
      <main className="flex-1">{children}</main>
    </div>
  );
}

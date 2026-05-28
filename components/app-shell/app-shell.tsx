import Link from "next/link";
import { Plane } from "lucide-react";
import { type ReactNode } from "react";

import { DepartmentNav } from "./department-nav";
import { PrimaryNav } from "./primary-nav";
import { TenantSwitcher } from "./tenant-switcher";

/**
 * Two-row app chrome, matching the legacy dispatch-platform pattern:
 *
 *   ┌──────────────────────────────────────────────────────────────────┐
 *   │  ✈ FlightOps  | Operations  Maintenance ...  | Org  User Signout │   primary
 *   ├──────────────────────────────────────────────────────────────────┤
 *   │  🏠 ▸  Dispatch  Dashboards  Flight Following ...                │   department
 *   └──────────────────────────────────────────────────────────────────┘
 *
 * The department row only renders when the user is inside one of the
 * department's path prefixes (e.g. /dispatch, /dashboards/* → Operations).
 *
 * `userSlot` is rendered at the right end of the primary nav. It's a slot
 * so the parent layout can wire its own auth/session-fetch logic without
 * AppShell needing to know about server actions or session shape.
 */
export interface AppShellProps {
  children: ReactNode;
  userSlot?: ReactNode;
}

export function AppShell({ children, userSlot }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-12 items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <Plane className="h-4 w-4 text-primary" aria-hidden />
            <span>FlightOps</span>
          </Link>

          <div className="flex-1">
            <PrimaryNav />
          </div>

          <div className="flex items-center gap-3">
            <TenantSwitcher />
            {userSlot}
          </div>
        </div>

        <DepartmentNav />
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}

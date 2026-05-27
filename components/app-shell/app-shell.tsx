import Link from "next/link";
import { Plane } from "lucide-react";
import { type ReactNode } from "react";

import { TenantSwitcher } from "./tenant-switcher";

/**
 * Shared layout chrome for in-app routes: a slim header carrying the brand,
 * primary nav, and the tenant switcher. Pages render inside <main>.
 *
 * The header is rendered by a server component but contains client-only
 * children (the switcher). Wrapping happens at the (app) route group's
 * layout so /login and / stay untouched.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
          >
            <Plane className="h-4 w-4 text-primary" aria-hidden />
            <span>FlightOps</span>
          </Link>

          <nav
            aria-label="Primary"
            className="flex items-center gap-1 text-sm text-muted-foreground"
          >
            <Link
              href="/dispatch"
              className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              Dispatch
            </Link>
            <Link
              href="/dashboards"
              className="rounded-md px-3 py-1.5 hover:bg-accent hover:text-accent-foreground"
            >
              Dashboards
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <TenantSwitcher />
          </div>
        </div>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}

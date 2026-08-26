"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

import { DepartmentNav } from "./department-nav";

/** Client wrapper around the app-shell's dark top header + department nav.
 *  Hides itself when on /home — that page renders its own light-themed
 *  top bar (HomeTopBar) for the pitch skin. All other routes keep the
 *  standard dark Peregrine chrome. */
export function AppShellHeader({
  brand,
  actionsSlot,
  roles = [],
}: {
  brand: string;
  actionsSlot?: ReactNode;
  /** Session roles, threaded from the server layout. Passed as a prop
   *  rather than read here: importing next-auth into a presentational
   *  component drags next/server in and breaks the vitest run. */
  roles?: readonly string[];
}) {
  const pathname = usePathname();
  const isHome = pathname === "/home" || pathname === "/home/";
  if (isHome) return null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
      <div className="flex h-[50px] items-center justify-between px-4 sm:px-5">
        <div className="flex min-w-0 flex-shrink-0 items-center gap-1 overflow-hidden">
          <Link
            href="/home/"
            className="mr-3 flex flex-shrink-0 items-center gap-2"
          >
            <span className="truncate text-sm font-semibold tracking-tight text-foreground">
              {brand}
            </span>
          </Link>
        </div>
        {actionsSlot}
      </div>

      <DepartmentNav roles={roles} />
    </header>
  );
}

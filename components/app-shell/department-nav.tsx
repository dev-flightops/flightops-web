"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  departmentForPath,
  moduleStatusHint,
  type ModuleEntry,
} from "./modules";

/**
 * Second-row department-context nav. Renders nothing when the current path
 * isn't under any department (e.g. the home page or login).
 *
 * Pattern is borrowed from the legacy dispatch-platform's department row:
 * a leading Home breadcrumb chevron, then sibling-module chips for the
 * department the user is currently inside.
 */
export function DepartmentNav() {
  const pathname = usePathname() ?? "/";
  const dept = departmentForPath(pathname);
  if (!dept) return null;

  return (
    <div className="border-t border-border bg-muted">
      <div className="container flex items-center gap-1 px-3 py-1">
        <Link
          href="/"
          className="rounded-md p-1 text-muted-foreground hover:bg-primary/8 hover:text-status-blue"
          aria-label="Home"
        >
          <Home className="h-3 w-3 opacity-60" aria-hidden />
        </Link>
        <ChevronRight
          className="h-3 w-3 text-muted-foreground/40"
          aria-hidden
        />

        <nav
          aria-label={`${dept.label} modules`}
          className="flex items-center gap-0.5"
        >
          {dept.children.map((module) => (
            <DepartmentNavItem
              key={module.id}
              module={module}
              pathname={pathname}
            />
          ))}
        </nav>
      </div>
    </div>
  );
}

function DepartmentNavItem({
  module,
  pathname,
}: {
  module: ModuleEntry;
  pathname: string;
}) {
  const isLive = module.status === "live";
  const isActive = isLive && module.href ? pathname.startsWith(module.href) : false;

  const className = cn(
    "rounded-md px-1.5 py-1 text-[0.68rem] font-medium whitespace-nowrap transition-colors",
    isActive
      ? "bg-primary/12 text-status-blue font-semibold"
      : "text-muted-foreground hover:bg-primary/8 hover:text-status-blue",
    !isLive && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
  );

  if (!isLive || !module.href) {
    return (
      <span
        className={className}
        title={moduleStatusHint(module.status)}
        aria-disabled="true"
        data-testid={`dept-nav-${module.id}`}
      >
        {module.label}
      </span>
    );
  }

  return (
    <Link
      href={module.href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      data-testid={`dept-nav-${module.id}`}
    >
      {module.label}
    </Link>
  );
}

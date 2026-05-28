"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  DEPARTMENTS,
  type DepartmentId,
  moduleStatusHint,
  departmentForPath,
} from "./modules";

/**
 * Top-row primary nav: one chip per department. Disabled departments
 * (anything not yet shipped) render greyed out with a tooltip indicating
 * the milestone they land in.
 *
 * Active department is derived from the current URL via departmentForPath
 * so the highlight stays consistent with what the DepartmentNav renders
 * underneath.
 */
export function PrimaryNav() {
  const pathname = usePathname() ?? "/";
  const activeDept = departmentForPath(pathname);

  return (
    <nav
      aria-label="Primary"
      className="flex items-center gap-0.5 text-[0.78rem] font-medium"
    >
      {DEPARTMENTS.map((dept) => (
        <PrimaryNavItem
          key={dept.id}
          deptId={dept.id}
          label={dept.label}
          isActive={activeDept?.id === dept.id}
          isDisabled={dept.status !== "live"}
          hint={moduleStatusHint(dept.status)}
          // The first live child is where clicking the department takes you.
          // Disabled departments don't navigate.
          href={dept.children.find((c) => c.status === "live")?.href}
        />
      ))}
    </nav>
  );
}

interface PrimaryNavItemProps {
  deptId: DepartmentId;
  label: string;
  isActive: boolean;
  isDisabled: boolean;
  hint: string;
  href?: string;
}

function PrimaryNavItem({
  deptId,
  label,
  isActive,
  isDisabled,
  hint,
  href,
}: PrimaryNavItemProps) {
  const className = cn(
    "rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors",
    isActive
      ? "bg-primary/12 text-status-blue font-semibold"
      : "text-muted-foreground hover:bg-primary/8 hover:text-status-blue",
    isDisabled && "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground",
  );

  if (isDisabled || !href) {
    return (
      <span
        className={className}
        title={hint || undefined}
        aria-disabled="true"
        data-testid={`primary-nav-${deptId}`}
      >
        {label}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
      data-testid={`primary-nav-${deptId}`}
    >
      {label}
    </Link>
  );
}

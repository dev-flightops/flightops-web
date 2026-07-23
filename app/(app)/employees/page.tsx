import Link from "next/link";

import { listMyTenants, listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { UserResponse } from "@/lib/api/types";

import { StatusFilter } from "./status-filter";

/**
 * /employees — HR employee directory.
 *
 * Matches legacy `peregrineflight.com/employees/`:
 *   Header:  "Employees" + "N records" | Active/Terminated/All | + New Employee
 *   Table:   EMP # · NAME · DEPARTMENT · TITLE · STATION · TYPE · HIRE DATE · STATUS
 *
 * Data slice (first cut): auth-service exposes `listUsers()` with
 * full_name, roles, is_active, created_at, last_login_at — but not the
 * employment-specific columns legacy renders (emp_number, title,
 * station, employment_type, hire_date). We derive what we can and
 * placeholder the rest with "—". Marc's HR/Payroll M3 story adds real
 * columns to auth-service (or a dedicated employee table); this UI
 * swaps to the real fields when they land.
 */
export const dynamic = "force-dynamic";

type StatusParam = "active" | "terminated" | "all";

function parseStatus(v: string | string[] | undefined): StatusParam {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "terminated" || s === "all") return s;
  return "active";
}

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);

  let users: UserResponse[] = [];
  let tenantSlug = "EMP";
  let loadError: string | null = null;
  try {
    const [usersResponse, tenantsResponse] = await Promise.all([
      listUsers(),
      listMyTenants().catch(() => null),
    ]);
    users = usersResponse.items;
    if (tenantsResponse) {
      const current =
        tenantsResponse.tenants.find((t) => t.is_current) ??
        tenantsResponse.tenants[0];
      if (current?.slug) tenantSlug = current.slug.toUpperCase();
    }
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have permission to view the employee directory."
          : "Employees unavailable. Try refreshing in a moment.";
  }

  const filtered = users.filter((u) => {
    if (statusFilter === "active") return u.is_active;
    if (statusFilter === "terminated") return !u.is_active;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusFilter value={statusFilter} />
          <Link
            href="/settings/users"
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            + New Employee
          </Link>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {statusFilter === "terminated"
              ? "No terminated employees."
              : statusFilter === "all"
                ? "No employees yet."
                : "No active employees."}
          </p>
        </div>
      ) : (
        <EmployeesTable users={filtered} tenantSlug={tenantSlug} />
      )}
    </div>
  );
}

function EmployeesTable({
  users,
  tenantSlug,
}: {
  users: UserResponse[];
  tenantSlug: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Emp #</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Department</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Title</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Station</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Type</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Hire date</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((u, i) => (
              <tr key={u.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-[0.7rem] text-muted-foreground">
                  {u.emp_number ?? empNumber(tenantSlug, i)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                  <Link
                    href="/settings/users"
                    className="text-status-blue hover:underline"
                  >
                    {u.full_name}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {roleToDepartment(u.roles[0]) ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {u.title ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {u.station ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatEmploymentType(u.employment_type)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {u.hire_date
                    ? formatHireDate(u.hire_date)
                    : formatHireDate(u.created_at)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                      (u.is_active
                        ? "border-status-green/40 bg-status-green/10 text-status-green"
                        : "border-border bg-muted/30 text-muted-foreground")
                    }
                  >
                    {u.is_active
                      ? "Active"
                      : u.termination_date
                        ? "Terminated"
                        : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Fallback for rows where the operator hasn't set emp_number yet
// (migration 0054 columns are nullable). Row-index-derived so demo
// data still reads like the legacy DEMO-200 numbering.
function empNumber(tenantSlug: string, i: number): string {
  return `${tenantSlug}-${(200 + i).toString().padStart(3, "0")}`;
}

const _ROLE_TO_DEPT: Record<string, string> = {
  exec_admin: "admin",
  dispatcher: "dispatch",
  chief_pilot: "flight_ops",
  pilot: "flight_ops",
  crew_member: "flight_ops",
  maintenance: "maintenance",
  ground_ops: "ground_ops",
  safety_officer: "safety",
};

function roleToDepartment(role: string | undefined): string | null {
  if (!role) return null;
  return _ROLE_TO_DEPT[role] ?? role;
}

const _EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  contract: "Contract",
  seasonal: "Seasonal",
};

function formatEmploymentType(t: string | null): string {
  if (!t) return "—";
  return _EMPLOYMENT_TYPE_LABELS[t] ?? t;
}

function formatHireDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

import Link from "next/link";

import { listAdminAccess, listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AdminAccessRoleRow, UserResponse } from "@/lib/api/types";

import { AdminAccessToggle } from "./admin-access-toggle";

/**
 * /settings/permissions — Role catalog + per-tenant Admin Access toggle
 * (M2-G-48 + M2-X-1).
 *
 * Per the M1 demo review (Jun 18 2026): every role gets an Admin
 * Access on/off switch so operators can decide which roles can see
 * /dashboards/*. The toggle writes to `tenant_role_admin_access` on the
 * backend; the JWT mints the union of those flags as `admin_access`
 * which the app-shell reads to gate the Admin card and the dashboards
 * routes.
 *
 * Editing the role catalog itself is intentionally not on this page —
 * roles are a code-level constant; granular per-action permissions
 * land with the M4 permission system.
 */
export default async function SettingsPermissionsPage() {
  let roles: AdminAccessRoleRow[] = [];
  let users: UserResponse[] = [];
  let loadError: string | null = null;
  let unauthorized = false;

  try {
    const [accessResponse, usersResponse] = await Promise.all([
      listAdminAccess(),
      listUsers(),
    ]);
    roles = accessResponse.roles;
    users = usersResponse.items;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else if (err.status === 403) {
        unauthorized = true;
      } else {
        loadError = "Permissions catalog unavailable.";
      }
    } else {
      loadError = "Permissions catalog unavailable.";
    }
  }

  const activeUserCount = (roleId: string) =>
    users.filter((u) => u.is_active && u.roles.includes(roleId)).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Permissions</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Permissions</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Roles available in FlightOps and which ones can access the Admin
          portal (dashboards, analytics, user management).
        </p>
      </header>

      {unauthorized && (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          You need the Executive Admin role to see the permissions catalog.
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      {!unauthorized && !loadError && (
        // The roles as one list, a row each (#86), not a stack of cards.
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {roles.map((role) => {
            const count = activeUserCount(role.id);
            return (
              <li key={role.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {role.label}
                      </h2>
                      <code className="font-mono text-[0.65rem] text-muted-foreground">
                        {role.id}
                      </code>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {role.description}
                    </p>
                    <p className="mt-2 eyebrow">
                      {count} active {count === 1 ? "user" : "users"}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AdminAccessToggle
                      roleId={role.id}
                      initial={role.admin_access}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!unauthorized && !loadError && (
        <p className="mt-6 text-xs text-muted-foreground">
          To assign roles, edit a user on the{" "}
          <Link
            href="/settings/users"
            className="text-primary hover:underline"
          >
            Users page
          </Link>
          . Granular per-action permissions (e.g. &quot;dispatcher can release
          but not cancel&quot;) aren&apos;t available yet. Users have to sign out and back in
          for an Admin Access change to take effect.
        </p>
      )}
    </div>
  );
}

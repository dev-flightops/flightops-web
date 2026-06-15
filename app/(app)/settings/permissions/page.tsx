import Link from "next/link";

import { listRoles, listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { RoleSummary, UserResponse } from "@/lib/api/types";

/**
 * /settings/permissions — Role catalog (M2-G-48).
 *
 * Read-only view of the canonical role list (defined in
 * shared/flightops_shared/auth/roles.py). Shows each role's display
 * label, description, and a small count of how many active users
 * currently hold it — useful sanity check ("does anyone actually have
 * the maintenance role yet?").
 *
 * Editing the role catalog itself is intentionally not on this page —
 * roles are a code-level constant; UI-editable per-tenant permissions
 * land with the granular permission system in M4.
 */
export default async function SettingsPermissionsPage() {
  let roles: RoleSummary[] = [];
  let users: UserResponse[] = [];
  let loadError: string | null = null;
  let unauthorized = false;

  try {
    const [rolesResponse, usersResponse] = await Promise.all([
      listRoles(),
      listUsers(),
    ]);
    roles = rolesResponse.roles;
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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Permissions</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Roles available in FlightOps and what each one is allowed to do
        </p>
      </header>

      {unauthorized && (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          You need the Executive Admin role to see the permissions catalog.
        </div>
      )}

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!unauthorized && !loadError && (
        <ul className="space-y-3">
          {roles.map((role) => {
            const count = activeUserCount(role.id);
            return (
              <li
                key={role.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">
                        {role.label}
                      </h2>
                      <code className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 font-mono text-[0.65rem] text-muted-foreground">
                        {role.id}
                      </code>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {role.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold text-foreground">
                      {count}
                    </div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Active {count === 1 ? "user" : "users"}
                    </div>
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
            className="text-status-blue hover:underline"
          >
            Users page
          </Link>
          . Granular per-action permissions (e.g. &quot;dispatcher can release
          but not cancel&quot;) ship in M4.
        </p>
      )}
    </div>
  );
}

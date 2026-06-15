import Link from "next/link";

import { auth } from "@/auth";
import { AddUserDialog } from "@/components/settings/users/add-user-dialog";
import { DeactivateUserButton } from "@/components/settings/users/deactivate-user-button";
import { EditUserDialog } from "@/components/settings/users/edit-user-dialog";
import { SetPasswordDialog } from "@/components/settings/users/set-password-dialog";
import { listRoles, listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { RoleSummary, UserResponse } from "@/lib/api/types";

/**
 * /settings/users — Admin user directory (M2-G-48).
 *
 * Lists active users first; inactive users render in a muted section
 * below. The role chips show what each user can do; the role catalog
 * is the source of truth and lives on /settings/permissions for the
 * authoritative description text.
 */
export default async function SettingsUsersPage() {
  let users: UserResponse[] = [];
  let roles: RoleSummary[] = [];
  let loadError: string | null = null;
  let unauthorized = false;
  try {
    const [usersResponse, rolesResponse] = await Promise.all([
      listUsers(),
      listRoles(),
    ]);
    users = usersResponse.items;
    roles = rolesResponse.roles;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) {
        loadError = "Your session expired — please sign in again.";
      } else if (err.status === 403) {
        unauthorized = true;
      } else {
        loadError = "Users unavailable. Try refreshing in a moment.";
      }
    } else {
      loadError = "Users unavailable. Try refreshing in a moment.";
    }
  }

  const roleLabel = (id: string) =>
    roles.find((r) => r.id === id)?.label ?? id;

  const session = await auth();
  const myId = session?.user?.id ?? null;

  const active = users.filter((u) => u.is_active);
  const inactive = users.filter((u) => !u.is_active);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Users</span>
      </nav>

      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite users, assign roles, set or reset passwords
          </p>
        </div>
        {!unauthorized && !loadError && <AddUserDialog roles={roles} />}
      </header>

      {unauthorized && (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          You need the Executive Admin role to manage users. Ask another
          exec admin to grant you the role.
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

      {!unauthorized && !loadError && users.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No users yet. Add the first one to get going — start with
            yourself or another exec admin.
          </p>
        </div>
      )}

      {!unauthorized && active.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <UsersTable
            users={active}
            roles={roles}
            roleLabel={roleLabel}
            myId={myId}
          />
        </section>
      )}

      {!unauthorized && inactive.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Inactive ({inactive.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card/40 opacity-70">
            <UsersTable
              users={inactive}
              roles={roles}
              roleLabel={roleLabel}
              myId={myId}
              muted
            />
          </div>
        </section>
      )}

      {!unauthorized && (
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Wondering what each role can do?{" "}
          <Link
            href="/settings/permissions"
            className="text-status-blue hover:underline"
          >
            See the role catalog →
          </Link>
        </div>
      )}
    </div>
  );
}

function UsersTable({
  users,
  roles,
  roleLabel,
  myId,
  muted,
}: {
  users: UserResponse[];
  roles: RoleSummary[];
  roleLabel: (id: string) => string;
  myId: string | null;
  muted?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/20 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <tr>
          <th scope="col" className="px-4 py-2 text-left">User</th>
          <th scope="col" className="px-4 py-2 text-left">Roles</th>
          <th scope="col" className="px-4 py-2 text-left">Sign-in</th>
          <th scope="col" className="px-4 py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === myId;
          return (
            <tr
              key={u.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/10"
            >
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="flex items-center gap-2 font-semibold text-foreground">
                    {u.full_name}
                    {isSelf && (
                      <span className="rounded-sm border border-border bg-muted/30 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        You
                      </span>
                    )}
                  </span>
                  <span className="text-[0.75rem] text-muted-foreground">
                    {u.email}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                {u.roles.length === 0 ? (
                  <span className="text-[0.7rem] text-muted-foreground">
                    No roles
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded-sm border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold text-foreground"
                      >
                        {roleLabel(r)}
                      </span>
                    ))}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {!u.has_password ? (
                  <span className="text-[0.7rem] text-status-yellow">
                    Invite pending
                  </span>
                ) : u.last_login_at ? (
                  <span className="text-[0.7rem]">
                    Last seen {formatDate(u.last_login_at)}
                  </span>
                ) : (
                  <span className="text-[0.7rem]">Never signed in</span>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  {!muted && (
                    <EditUserDialog
                      user={u}
                      roles={roles}
                      isSelf={isSelf}
                    />
                  )}
                  {!muted && (
                    <SetPasswordDialog
                      userId={u.id}
                      email={u.email}
                      hasPassword={u.has_password}
                    />
                  )}
                  {!muted && !isSelf && (
                    <DeactivateUserButton
                      userId={u.id}
                      email={u.email}
                    />
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatDate(iso: string): string {
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

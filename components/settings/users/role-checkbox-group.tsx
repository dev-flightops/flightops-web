"use client";

import type { RoleSummary } from "@/lib/api/types";

/**
 * Multi-select role picker rendered as a checkbox grid so the user can
 * see every role + its description while choosing. Each checkbox emits a
 * `roles` form value; the server action collects them via
 * `formData.getAll("roles")`.
 */
export function RoleCheckboxGroup({
  roles,
  defaultSelected = [],
  error,
}: {
  roles: RoleSummary[];
  defaultSelected?: string[];
  error?: string;
}) {
  const selected = new Set(defaultSelected);
  return (
    <div>
      <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Roles
      </div>
      <ul
        className={`grid gap-2 rounded-md border bg-card/40 p-3 ${
          error ? "border-status-red" : "border-border"
        }`}
      >
        {roles.map((role) => (
          <li key={role.id}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                name="roles"
                value={role.id}
                defaultChecked={selected.has(role.id)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-background text-status-blue focus:ring-status-blue"
              />
              <span>
                <span className="text-sm font-semibold text-foreground">
                  {role.label}
                </span>
                <span className="block text-[0.7rem] text-muted-foreground">
                  {role.description}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

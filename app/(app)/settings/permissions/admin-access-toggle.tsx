"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { toggleAdminAccessAction } from "./actions";

interface Props {
  roleId: string;
  initial: boolean;
  /** Set to true to render disabled (e.g. for exec_admin — keeping the
   *  toggle locked on prevents an operator from accidentally locking
   *  themselves out of their own admin portal). */
  locked?: boolean;
}

/**
 * Settings → Permissions → per-role Admin Access toggle (M2-X-1).
 *
 * Submits the flip through `toggleAdminAccessAction` (server action) so
 * the API call lives server-side where the Auth.js session cookie is
 * actually readable. Calling `setAdminAccess` directly from this
 * client component used to fail with "no session", surfaced as
 * "Couldn't save — try again".
 *
 * Optimistic UI: the local state flips immediately so the click feels
 * responsive; on action failure we roll back to the original value
 * and surface a context-specific inline message.
 *
 * exec_admin stays locked on regardless of what's passed in. Phil's
 * review was explicit that Admin is Admin; turning the toggle off for
 * exec_admin would leave a tenant unable to reach Settings at all.
 */
export function AdminAccessToggle({ roleId, initial, locked }: Props) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isLocked = locked || roleId === "exec_admin";

  const handleChange = (next: boolean) => {
    if (isLocked) return;
    const previous = enabled;
    setEnabled(next);
    setError(null);

    startTransition(async () => {
      // The action validates `role` against the catalog with zod, so an
      // unknown roleId returns `error: "unknown_role"` rather than
      // throwing at the type boundary. Cast is safe.
      const result = await toggleAdminAccessAction({
        role: roleId as Parameters<typeof toggleAdminAccessAction>[0]["role"],
        admin_access: next,
      });
      if (!result.ok) {
        setEnabled(previous);
        if (result.error === "forbidden") {
          setError("You need Executive Admin to change this.");
        } else if (result.error === "unknown_role") {
          setError("Unknown role.");
        } else {
          setError("Couldn't save — try again.");
        }
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 text-xs",
          isLocked && "cursor-not-allowed opacity-60",
        )}
        title={
          isLocked
            ? "Executive Admin always has Admin Access"
            : enabled
              ? "Click to revoke Admin Access from this role"
              : "Click to grant Admin Access to this role"
        }
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={enabled}
          disabled={isLocked || pending}
          onChange={(e) => handleChange(e.target.checked)}
          aria-label={`Admin Access for ${roleId}`}
        />
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
            enabled
              ? "bg-status-blue/80"
              : "bg-muted-foreground/30",
            isLocked && "opacity-70",
          )}
        >
          <span
            className={cn(
              "absolute inline-block h-3.5 w-3.5 transform rounded-full bg-background shadow transition-transform",
              enabled ? "translate-x-[1.2rem]" : "translate-x-[0.15rem]",
            )}
          />
        </span>
        <span
          className={cn(
            "font-semibold tracking-[0.04em] uppercase",
            enabled ? "text-status-blue" : "text-muted-foreground",
          )}
        >
          {enabled ? "Admin" : "—"}
        </span>
      </label>
      {error && (
        <span role="alert" className="text-[0.65rem] text-status-red">
          {error}
        </span>
      )}
    </div>
  );
}

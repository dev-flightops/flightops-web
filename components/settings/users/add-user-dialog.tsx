"use client";

import { useActionState, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { RoleSummary } from "@/lib/api/types";

import {
  createUserAction,
  type UsersActionState,
} from "@/app/(app)/settings/users/actions";

import { RoleCheckboxGroup } from "./role-checkbox-group";

export function AddUserDialog({ roles }: { roles: RoleSummary[] }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UsersActionState, FormData>(
    createUserAction,
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "ok") setOpen(false);
  }, [state.status]);

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white hover:brightness-110"
      >
        + Add User
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              Set an initial password to create a usable account today, or
              leave it blank to create an invite-pending user (they can't
              log in until you set a password).
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="email"
                label="Email"
                type="email"
                required
                error={fieldError("email")}
              />
              <Field
                name="full_name"
                label="Full name"
                required
                error={fieldError("full_name")}
              />
            </div>

            <Field
              name="password"
              label="Initial password (optional)"
              type="password"
              placeholder="Leave blank to send an invite-pending user"
              autoComplete="new-password"
              error={fieldError("password")}
            />

            <RoleCheckboxGroup roles={roles} error={fieldError("roles")} />

            <DialogFooter>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
              >
                {pending && <Spinner size="xs" />}
                {pending ? "Adding…" : "Add user"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  name,
  label,
  error,
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
        {inputProps.required && <span className="text-status-red"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? "true" : undefined}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

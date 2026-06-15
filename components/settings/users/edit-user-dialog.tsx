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
import type { RoleSummary, UserResponse } from "@/lib/api/types";

import {
  updateUserAction,
  type UsersActionState,
} from "@/app/(app)/settings/users/actions";

import { RoleCheckboxGroup } from "./role-checkbox-group";

export function EditUserDialog({
  user,
  roles,
  isSelf,
}: {
  user: UserResponse;
  roles: RoleSummary[];
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UsersActionState, FormData>(
    updateUserAction,
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
        className="rounded-md border border-border bg-card px-2.5 py-1 text-[0.7rem] font-semibold text-foreground hover:bg-muted/40"
      >
        Edit
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit {user.email}</DialogTitle>
            <DialogDescription>
              Email is fixed once a user is created. {isSelf
                ? "You're editing yourself — roles + active status can't be changed here (do that from another admin's account)."
                : "Use the role checkboxes to grant or remove access."}
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="user_id" value={user.id} />

            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <Field
              name="full_name"
              label="Full name"
              required
              defaultValue={user.full_name}
              error={fieldError("full_name")}
            />

            <fieldset disabled={isSelf}>
              <RoleCheckboxGroup
                roles={roles}
                defaultSelected={user.roles}
                error={fieldError("roles")}
              />
            </fieldset>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={user.is_active}
                disabled={isSelf}
                className="h-4 w-4 rounded border-border bg-background text-status-blue focus:ring-status-blue disabled:opacity-50"
              />
              Active (can sign in)
            </label>

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
                {pending ? "Saving…" : "Save"}
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

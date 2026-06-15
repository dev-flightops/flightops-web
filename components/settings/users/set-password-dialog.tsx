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

import {
  setPasswordAction,
  type UsersActionState,
} from "@/app/(app)/settings/users/actions";

export function SetPasswordDialog({
  userId,
  email,
  hasPassword,
}: {
  userId: string;
  email: string;
  hasPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<UsersActionState, FormData>(
    setPasswordAction,
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
        {hasPassword ? "Reset password" : "Set password"}
      </button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>
              {hasPassword ? "Reset" : "Set"} password for {email}
            </DialogTitle>
            <DialogDescription>
              {hasPassword
                ? "The user's existing password will be invalidated. Share the new one over a secure channel."
                : "The user is currently invite-pending. Setting a password lets them log in."}
            </DialogDescription>
          </DialogHeader>

          <form action={action} className="space-y-4">
            <input type="hidden" name="user_id" value={userId} />

            {state.status === "api-error" && (
              <div
                role="alert"
                className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
              >
                {state.message}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
              >
                New password <span className="text-status-red">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                aria-invalid={fieldError("password") ? "true" : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
              />
              {fieldError("password") && (
                <p
                  role="alert"
                  className="mt-1 text-[0.65rem] text-status-red"
                >
                  {fieldError("password")}
                </p>
              )}
            </div>

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
                {pending ? "Saving…" : "Save password"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

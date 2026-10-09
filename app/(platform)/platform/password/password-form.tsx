"use client";

import { useActionState } from "react";

import { changePasswordAction, type PasswordState } from "./actions";

const _initial: PasswordState = { status: "idle", attempt: 0 };
const FIELD = "ff-input text-sm";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, _initial);
  return (
    <form key={state.attempt} action={formAction} aria-label="Change password" className="grid gap-3">
      {state.status === "error" && state.message ? (
        <div role="alert" className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red">
          {state.message}
        </div>
      ) : null}
      {state.status === "ok" ? (
        <p role="status" className="text-xs font-semibold text-status-green">
          {state.message}
        </p>
      ) : null}
      <label className="grid gap-1 text-xs">
        Current Password
        <input name="current_password" type="password" required autoComplete="current-password" className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        New Password (12 characters or more)
        <input name="new_password" type="password" required minLength={12} autoComplete="new-password" className={FIELD} />
      </label>
      <label className="grid gap-1 text-xs">
        New Password Again
        <input name="confirm_password" type="password" required minLength={12} autoComplete="new-password" className={FIELD} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change Password"}
      </button>
    </form>
  );
}

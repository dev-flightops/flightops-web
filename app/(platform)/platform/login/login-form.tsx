"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import { platformLoginAction, type PlatformLoginState } from "./actions";

const FIELD =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none";
const LABEL = "mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

export function PlatformLoginForm() {
  const [state, action, pending] = useActionState<PlatformLoginState, FormData>(platformLoginAction, {
    status: "idle",
  });
  const typed = state.status === "error" ? state.email : "";

  return (
    <form action={action} aria-label="Platform sign-in" className="space-y-3">
      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className={LABEL}>
          Email
        </label>
        <input id="email" name="email" type="email" required autoComplete="email" defaultValue={typed} className={FIELD} />
      </div>
      <div>
        <label htmlFor="password" className={LABEL}>
          Password
        </label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className={FIELD} />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

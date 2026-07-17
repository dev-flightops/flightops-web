"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  supplierLoginAction,
  type SupplierLoginState,
} from "./actions";

export function SupplierLoginForm() {
  const [state, action, pending] = useActionState<
    SupplierLoginState,
    FormData
  >(supplierLoginAction, { status: "idle" });

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="space-y-3">
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
          htmlFor="email"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
          aria-invalid={fieldError("email") ? "true" : undefined}
        />
        {fieldError("email") && (
          <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
            {fieldError("email")}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
          aria-invalid={fieldError("password") ? "true" : undefined}
        />
        {fieldError("password") && (
          <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
            {fieldError("password")}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

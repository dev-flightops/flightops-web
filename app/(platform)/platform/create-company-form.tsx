"use client";

import { useActionState } from "react";

import { createCompanyAction, type CreateCompanyState } from "./actions";

const _initial: CreateCompanyState = { status: "idle", attempt: 0 };
const FIELD = "ff-input text-sm";

/**
 * Legacy's "create company" on /owner/companies: the company and its
 * first Exec Admin. The admin's one-time password is shown here once,
 * after creating, and nowhere else.
 */
export function CreateCompanyForm() {
  const [state, formAction, pending] = useActionState(createCompanyAction, _initial);
  const sent = state.status === "error" ? state.values : undefined;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Create a Company</h2>
      {state.status === "ok" && state.created ? (
        <div role="status" className="mt-3 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-3 text-sm">
          <p className="font-semibold text-status-green">{state.created.name} is set up.</p>
          <p className="mt-1">
            Exec Admin <span className="font-mono">{state.created.admin_email}</span>, one-time password:{" "}
            <span className="select-all rounded bg-background px-1.5 py-0.5 font-mono font-semibold">
              {state.created.one_time_password}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Shown once. Copy it now and hand it over securely; they set their own in user settings.
          </p>
        </div>
      ) : null}
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mt-3 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}
      <form
        key={state.attempt}
        action={formAction}
        aria-label="Create a company"
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <label className="grid gap-1 text-xs">
          Company Name *
          <input name="name" required maxLength={120} defaultValue={sent?.name ?? ""} className={FIELD} />
        </label>
        <label className="grid gap-1 text-xs">
          Short Name
          <input
            name="slug"
            maxLength={60}
            placeholder="From the name, e.g. aurora-air"
            defaultValue={sent?.slug ?? ""}
            className={`${FIELD} font-mono`}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Exec Admin&apos;s Name *
          <input name="admin_name" required maxLength={120} defaultValue={sent?.admin_name ?? ""} className={FIELD} />
        </label>
        <label className="grid gap-1 text-xs">
          Exec Admin&apos;s Email *
          <input
            name="admin_email"
            type="email"
            required
            maxLength={254}
            defaultValue={sent?.admin_email ?? ""}
            className={FIELD}
          />
        </label>
        <div className="flex justify-end sm:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create Company"}
          </button>
        </div>
      </form>
    </div>
  );
}

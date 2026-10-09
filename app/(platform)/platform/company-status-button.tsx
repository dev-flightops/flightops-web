"use client";

import { useActionState, useState } from "react";

import { setCompanyActiveAction, type CompanyStatusState } from "./actions";

const _initial: CompanyStatusState = { status: "idle", attempt: 0 };

/** Suspend or reactivate, after a second click that says what it does. */
export function CompanyStatusButton({ companyId, name, active }: { companyId: string; name: string; active: boolean }) {
  const [state, formAction, pending] = useActionState(setCompanyActiveAction, _initial);
  const [asking, setAsking] = useState(false);
  const verb = active ? "Suspend" : "Reactivate";

  if (!asking) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={
            "text-xs font-semibold hover:underline " + (active ? "text-status-red" : "text-foreground/80")
          }
        >
          {verb}
        </button>
        {state.status === "error" && state.message ? (
          <span role="alert" className="text-[0.6875rem] text-status-red">
            {state.message}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <form action={formAction} onSubmit={() => setAsking(false)} className="inline-flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="company_id" value={companyId} />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <span className="text-xs text-muted-foreground">
        {active
          ? `Suspend ${name}? Nobody there can sign in, and their sessions end within the hour.`
          : `Reactivate ${name}? Their people can sign in again.`}
      </span>
      <button
        type="submit"
        disabled={pending}
        className={
          "rounded border px-2 py-0.5 text-xs font-semibold disabled:opacity-60 " +
          (active
            ? "border-status-red/40 bg-status-red/10 text-status-red"
            : "border-status-green/40 bg-status-green/10 text-status-green")
        }
      >
        {verb}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="text-xs text-muted-foreground hover:underline">
        Cancel
      </button>
    </form>
  );
}

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
            "text-[0.68rem] font-bold uppercase tracking-[0.1em] underline-offset-4 hover:underline " +
            (active ? "text-status-red" : "text-foreground")
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
          "btn-caps rounded border px-2 py-0.5 text-[0.68rem] disabled:opacity-60 " +
          (active
            ? "border-status-red/60 text-status-red hover:border-status-red"
            : "border-status-green/60 text-status-green hover:border-status-green")
        }
      >
        {verb}
      </button>
      <button type="button" onClick={() => setAsking(false)} className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-muted-foreground underline-offset-4 hover:underline">
        Cancel
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";

import { createScheduleAction, type ScheduleFormState } from "./actions";

const _initial: ScheduleFormState = { status: "idle", attempt: 0 };

/** "+ New Schedule" and its form (legacy `templates/manifest/template_list.html`).
 *  Saving goes to the new schedule's page, where its flights are added. */
export function NewSchedule() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createScheduleAction, _initial);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonSolid}>
        + New Schedule
      </button>
    );
  }
  return (
    <form action={action} aria-label="New schedule" className="flex w-full flex-wrap items-end gap-3">
      <label className="min-w-56 flex-1">
        <span className="field-label">Name</span>
        <input name="name" required maxLength={120} placeholder="Winter 2026" className="ff-input px-3 py-2 text-sm" />
      </label>
      <label className="min-w-56 flex-[2]">
        <span className="field-label">Description</span>
        <input name="description" maxLength={500} placeholder="Optional" className="ff-input px-3 py-2 text-sm" />
      </label>
      <button type="submit" disabled={pending} className={`${buttonSolid} disabled:opacity-60`}>
        {pending ? "Creating…" : "Create Schedule"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className={buttonOutline}>
        Cancel
      </button>
      {state.status === "error" ? (
        <p role="alert" className="field-error w-full">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

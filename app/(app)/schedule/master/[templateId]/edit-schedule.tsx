"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { ScheduleDetail } from "@/lib/api/master-schedule";

import { updateScheduleAction, type ScheduleFormState } from "../actions";

const _initial: ScheduleFormState = { status: "idle", attempt: 0 };

/** The schedule's name, description and whether it's in use. An inactive one
 *  can't be published. */
export function EditSchedule({ schedule }: { schedule: ScheduleDetail }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(updateScheduleAction, _initial);
  const [name, setName] = useState(schedule.name);
  const [description, setDescription] = useState(schedule.description ?? "");
  const [active, setActive] = useState(schedule.is_active);
  const handled = useRef(0);
  useEffect(() => {
    if (state.status === "ok" && state.attempt !== handled.current) {
      handled.current = state.attempt;
      setOpen(false);
    }
  }, [state]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonOutline}>
        Edit
      </button>
    );
  }
  return (
    <form action={action} aria-label="Edit schedule" className="flex w-full flex-wrap items-end gap-3">
      <input type="hidden" name="template_id" value={schedule.id} />
      <label className="min-w-56 flex-1">
        <span className="field-label">Name</span>
        <input
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="ff-input px-3 py-2 text-sm"
        />
      </label>
      <label className="min-w-56 flex-[2]">
        <span className="field-label">Description</span>
        <input
          name="description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="ff-input px-3 py-2 text-sm"
        />
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <input type="checkbox" name="is_active" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Active
      </label>
      <button type="submit" disabled={pending} className={`${buttonSolid} disabled:opacity-60`}>
        {pending ? "Saving…" : "Save"}
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

"use client";

import { useActionState } from "react";

import { enrolAction, type EnrolFormState } from "./actions";

const _initial: EnrolFormState = { status: "idle" };

export function EnrolButton({
  courseId,
  label,
}: {
  courseId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(enrolAction, _initial);
  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="course_id" value={courseId} />
      {state.status === "error" && state.message ? (
        <span
          role="alert"
          className="text-[0.6875rem] text-status-red"
        >
          {state.message}
        </span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
      >
        {pending ? "Enrolling…" : label}
      </button>
    </form>
  );
}

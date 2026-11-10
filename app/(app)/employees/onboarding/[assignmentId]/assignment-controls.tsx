"use client";

import { useState, useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
import type { StaffMember } from "@/lib/api/auth";
import type { AssignmentDetail } from "@/lib/api/onboarding";

import { updateAssignmentAction } from "../actions";

/** For whoever runs onboarding (#180): who the Supervisor tasks fall to, and
 *  archiving an onboarding that was a mistake or is no longer wanted. */
export function AssignmentControls({ assignment, staff }: { assignment: AssignmentDetail; staff: StaffMember[] }) {
  const [supervisor, setSupervisor] = useState(assignment.supervisor?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (body: Parameters<typeof updateAssignmentAction>[1]) =>
    startTransition(async () => {
      setError(null);
      const result = await updateAssignmentAction(assignment.id, body);
      if (!result.ok) setError(result.message);
    });
  const archived = assignment.status === "archived";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label htmlFor="onb-supervisor" className="field-label">
            Supervisor
          </label>
          <select
            id="onb-supervisor"
            value={supervisor}
            onChange={(e) => setSupervisor(e.target.value)}
            disabled={archived}
            className="ff-input px-3 py-2 text-sm"
          >
            <option value="">None: whoever runs onboarding</option>
            {staff
              .filter((s) => s.id !== assignment.employee.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          className={buttonOutline}
          disabled={pending || archived || supervisor === (assignment.supervisor?.id ?? "")}
          onClick={() => run({ supervisor_user_id: supervisor || null })}
        >
          Save Supervisor
        </button>
      </div>
      <button
        type="button"
        className={buttonOutline}
        disabled={pending}
        onClick={() => run({ status: archived ? "in_progress" : "archived" })}
      >
        {archived ? "Bring Back" : "Archive"}
      </button>
      {error ? (
        <p role="alert" className="field-error sm:basis-full">
          {error}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";
import type { StaffMember } from "@/lib/api/auth";
import type { ChecklistSummary } from "@/lib/api/onboarding";
import { formatRole } from "@/lib/roles";

import { assignChecklistAction } from "./actions";

/**
 * Assign a checklist to a new hire (#180), legacy's per-employee assign
 * form: the checklist, the hire date its tasks are due from (the employee's
 * own when left blank) and the supervisor their Supervisor tasks fall to.
 *
 * On the onboarding page the hire is picked from the staff; on the
 * employee's record they are fixed.
 */
export function AssignForm({
  checklists,
  staff,
  employee,
}: {
  checklists: ChecklistSummary[];
  staff: StaffMember[];
  employee?: { id: string; full_name: string };
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    employee_id: employee?.id ?? "",
    checklist_id: "",
    hire_date: "",
    supervisor_user_id: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (name: keyof typeof values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));

  if (checklists.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No checklists yet. Build one under Checklists, then assign it here.
      </p>
    );
  }

  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form
      method="post"
      aria-label="Assign a checklist"
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          setErrors({});
          const result = await assignChecklistAction(values);
          if (result.ok && result.id) router.push(`/employees/onboarding/${result.id}`);
          else if (!result.ok) {
            setErrors(result.errors ?? {});
            setMessage(result.message);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {employee ? null : (
          <div>
            <label htmlFor="assign-employee" className="field-label">
              New Hire<span className="text-status-red"> *</span>
            </label>
            <select id="assign-employee" value={values.employee_id} onChange={set("employee_id")} className="ff-input w-full px-3 py-2 text-sm">
              <option value="">Pick the new hire</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.roles[0] ? ` · ${formatRole(s.roles[0])}` : ""}
                </option>
              ))}
            </select>
            {error("employee_id")}
          </div>
        )}
        <div>
          <label htmlFor="assign-checklist" className="field-label">
            Checklist<span className="text-status-red"> *</span>
          </label>
          <select id="assign-checklist" value={values.checklist_id} onChange={set("checklist_id")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">Pick a checklist</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.target_role ? ` · for ${formatRole(c.target_role)}` : ""} ({c.task_count} task{c.task_count === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          {error("checklist_id")}
        </div>
        <div>
          <label htmlFor="assign-hire-date" className="field-label">
            Hire Date
          </label>
          <input id="assign-hire-date" type="date" value={values.hire_date} onChange={set("hire_date")} className="ff-input w-full px-3 py-2 text-sm" />
          <p className="mt-1 text-xs text-muted-foreground">Tasks are due from it. Blank: the employee&apos;s own hire date, else today.</p>
          {error("hire_date")}
        </div>
        <div>
          <label htmlFor="assign-supervisor" className="field-label">
            Supervisor
          </label>
          <select id="assign-supervisor" value={values.supervisor_user_id} onChange={set("supervisor_user_id")} className="ff-input w-full px-3 py-2 text-sm">
            <option value="">None: Supervisor tasks fall to whoever runs onboarding</option>
            {staff
              .filter((s) => s.id !== values.employee_id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
          </select>
          {error("supervisor_user_id")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="assign-notes" className="field-label">
            Notes
          </label>
          <input id="assign-notes" value={values.notes} onChange={set("notes")} maxLength={4000} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
      </div>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Assigning…" : "Assign Checklist"}
        </button>
      </div>
    </form>
  );
}

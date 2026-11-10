"use client";

import { useState, useTransition } from "react";

import { buttonSolid, linkCaps } from "@/components/ff/controls";
import type { DocumentRequirementRow } from "@/lib/api/employee-documents";
import type { ChecklistTask } from "@/lib/api/onboarding";
import { ASSIGNEE_KINDS, TASK_TYPES } from "@/lib/onboarding/options";
import { ROLES, formatRole } from "@/lib/roles";

import { addTaskAction, updateTaskAction } from "../../actions";

type Values = {
  name: string;
  description: string;
  task_type: string;
  assignee_kind: string;
  assignee_role: string;
  document_requirement_id: string;
  due_days_after_hire: string;
  required_before_start: boolean;
  notes: string;
};

function initial(task?: ChecklistTask): Values {
  return {
    name: task?.name ?? "",
    description: task?.description ?? "",
    task_type: task?.task_type ?? "other",
    assignee_kind: task?.assignee_kind ?? "hr",
    assignee_role: task?.assignee_role ?? "",
    document_requirement_id: task?.document_requirement_id ?? "",
    due_days_after_hire: String(task?.due_days_after_hire ?? 7),
    required_before_start: task?.required_before_start ?? false,
    notes: task?.notes ?? "",
  };
}

/**
 * One checklist task (#180), legacy's add and edit forms: its name, type, who
 * it falls to, how many days after the hire date it's due, and whether it's
 * required before the hire starts. A Document Upload task names the document
 * requirement its file is filed under (Settings → Document Requirements).
 */
export function TaskForm({
  checklistId,
  task,
  requirements,
  onDone,
}: {
  checklistId: string;
  /** The task being edited; none to add one. */
  task?: ChecklistTask;
  requirements: DocumentRequirementRow[];
  onDone?: () => void;
}) {
  const [values, setValues] = useState<Values>(initial(task));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const id = (name: string) => `task-${task?.id ?? "new"}-${name}`;
  const set = (name: keyof Values) => (e: { target: { value: string } }) =>
    setValues((prev) => ({ ...prev, [name]: e.target.value }));
  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="field-error">
        {errors[name]}
      </p>
    ) : null;
  const kind = ASSIGNEE_KINDS.find((k) => k.value === values.assignee_kind);

  return (
    <form
      method="post"
      aria-label={task ? `Edit ${task.name}` : "Add a task"}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setErrors({});
          setMessage(null);
          const result = task
            ? await updateTaskAction(checklistId, task.id, values)
            : await addTaskAction(checklistId, values);
          if (result.ok) {
            if (!task) setValues(initial());
            onDone?.();
          } else {
            setErrors(result.errors ?? {});
            setMessage(result.message);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={id("name")} className="field-label">
            Task<span className="text-status-red"> *</span>
          </label>
          <input id={id("name")} value={values.name} onChange={set("name")} maxLength={300} className="ff-input w-full px-3 py-2 text-sm" />
          {error("name")}
        </div>
        <div>
          <label htmlFor={id("type")} className="field-label">
            Type
          </label>
          <select id={id("type")} value={values.task_type} onChange={set("task_type")} className="ff-input w-full px-3 py-2 text-sm">
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {error("task_type")}
        </div>
        {values.task_type === "document_upload" ? (
          <div className="sm:col-span-2">
            <label htmlFor={id("requirement")} className="field-label">
              Files Under<span className="text-status-red"> *</span>
            </label>
            <select
              id={id("requirement")}
              value={values.document_requirement_id}
              onChange={set("document_requirement_id")}
              className="ff-input w-full px-3 py-2 text-sm"
            >
              <option value="">Pick the document</option>
              {requirements.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.has_expiry ? " (has an expiry date)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              The upload is filed in the employee&apos;s Documents as this. Document requirements are under Settings → Document Requirements.
            </p>
            {error("document_requirement_id")}
          </div>
        ) : null}
        <div>
          <label htmlFor={id("kind")} className="field-label">
            Falls To
          </label>
          <select id={id("kind")} value={values.assignee_kind} onChange={set("assignee_kind")} className="ff-input w-full px-3 py-2 text-sm">
            {ASSIGNEE_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          {kind ? <p className="mt-1 text-xs text-muted-foreground">{kind.hint}</p> : null}
          {error("assignee_kind")}
        </div>
        {values.assignee_kind === "custom" ? (
          <div>
            <label htmlFor={id("role")} className="field-label">
              Role<span className="text-status-red"> *</span>
            </label>
            <select id={id("role")} value={values.assignee_role} onChange={set("assignee_role")} className="ff-input w-full px-3 py-2 text-sm">
              <option value="">Pick the role</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {formatRole(r)}
                </option>
              ))}
            </select>
            {error("assignee_role")}
          </div>
        ) : null}
        <div>
          <label htmlFor={id("days")} className="field-label">
            Due Days After Hire
          </label>
          <input
            id={id("days")}
            type="number"
            min={0}
            max={3650}
            value={values.due_days_after_hire}
            onChange={set("due_days_after_hire")}
            className="ff-input w-full px-3 py-2 text-sm"
          />
          {error("due_days_after_hire")}
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id("description")} className="field-label">
            Description
          </label>
          <textarea
            id={id("description")}
            rows={2}
            value={values.description}
            onChange={set("description")}
            maxLength={4000}
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor={id("notes")} className="field-label">
            Notes
          </label>
          <input id={id("notes")} value={values.notes} onChange={set("notes")} maxLength={4000} className="ff-input w-full px-3 py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            checked={values.required_before_start}
            onChange={(e) => setValues((prev) => ({ ...prev, required_before_start: e.target.checked }))}
          />
          Required before the hire starts
          <span className="text-xs text-muted-foreground">
            Listed until it&apos;s done, here and in Settings → Users. It doesn&apos;t block the login.
          </span>
        </label>
      </div>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-3">
        {task && onDone ? (
          <button type="button" className={linkCaps} onClick={onDone}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : task ? "Save Task" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

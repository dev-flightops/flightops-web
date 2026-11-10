"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { StatusMark } from "@/components/ff/status-mark";
import type { DocumentRequirementRow } from "@/lib/api/employee-documents";
import type { ChecklistDetail } from "@/lib/api/onboarding";
import { assigneeLabel, taskTypeLabel } from "@/lib/onboarding/options";
import { ROLES, formatRole } from "@/lib/roles";

import { deleteTaskAction, reorderTasksAction, updateChecklistAction } from "../../actions";
import { TaskForm } from "./task-form";

/**
 * Editing a checklist (#180), legacy's templates/onboarding_checklist/checklist_edit.html:
 * its name and the role it's for, and its tasks in order. Legacy reordered
 * by dragging rows; here each task moves up or down, which a keyboard and a
 * phone can do too. An edit changes the checklist for hires assigned it from
 * now on, never the copies already under way.
 */
export function ChecklistEditor({
  checklist,
  requirements,
}: {
  checklist: ChecklistDetail;
  requirements: DocumentRequirementRow[];
}) {
  const [meta, setMeta] = useState({
    name: checklist.name,
    target_role: checklist.target_role ?? "",
    description: checklist.description ?? "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (work: () => Promise<{ ok: boolean; message?: string }>, done?: string) =>
    startTransition(async () => {
      setMessage(null);
      const result = await work();
      setMessage(result.ok ? (done ? { ok: true, text: done } : null) : { ok: false, text: result.message ?? "" });
    });

  const move = (index: number, by: -1 | 1) => {
    const ids = checklist.tasks.map((t) => t.id);
    const to = index + by;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    run(() => reorderTasksAction(checklist.id, ids));
  };

  return (
    <div className="space-y-8">
      <form
        method="post"
        aria-label="Checklist details"
        className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateChecklistAction(checklist.id, meta), "Saved.");
        }}
      >
        <div>
          <label htmlFor="meta-name" className="field-label">
            Name
          </label>
          <input
            id="meta-name"
            value={meta.name}
            onChange={(e) => setMeta({ ...meta, name: e.target.value })}
            maxLength={200}
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="meta-role" className="field-label">
            For
          </label>
          <select
            id="meta-role"
            value={meta.target_role}
            onChange={(e) => setMeta({ ...meta, target_role: e.target.value })}
            className="ff-input w-full px-3 py-2 text-sm"
          >
            <option value="">Any role</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {formatRole(r)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="meta-description" className="field-label">
            Description
          </label>
          <input
            id="meta-description"
            value={meta.description}
            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            maxLength={4000}
            className="ff-input w-full px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-3">
          <button
            type="button"
            className={buttonOutline}
            disabled={pending}
            onClick={() =>
              run(
                () => updateChecklistAction(checklist.id, { is_active: !checklist.is_active }),
                checklist.is_active ? "Archived: it's no longer offered when assigning." : "Back in use.",
              )
            }
          >
            {checklist.is_active ? "Archive Checklist" : "Bring Back"}
          </button>
          <button type="submit" className={buttonSolid} disabled={pending}>
            Save Details
          </button>
        </div>
      </form>

      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-status-green" : "field-error"}>
          {message.text}
        </p>
      ) : null}

      <section aria-label="Tasks">
        <h2 className="section-title mb-3">Tasks ({checklist.tasks.length})</h2>
        {checklist.tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet. Add the first one below.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th className="w-20">Order</th>
                  <th>Task</th>
                  <th>Falls To</th>
                  <th className="text-right">Due</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {checklist.tasks.map((t, i) =>
                  editing === t.id ? (
                    <tr key={t.id}>
                      <td colSpan={5} className="bg-muted/60">
                        <TaskForm checklistId={checklist.id} task={t} requirements={requirements} onDone={() => setEditing(null)} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          className={linkCaps}
                          disabled={pending || i === 0}
                          onClick={() => move(i, -1)}
                          aria-label={`Move ${t.name} up`}
                        >
                          <span aria-hidden>↑</span>
                        </button>
                        <button
                          type="button"
                          className={`${linkCaps} ml-2`}
                          disabled={pending || i === checklist.tasks.length - 1}
                          onClick={() => move(i, 1)}
                          aria-label={`Move ${t.name} down`}
                        >
                          <span aria-hidden>↓</span>
                        </button>
                      </td>
                      <td className="min-w-[220px]">
                        <span className="font-semibold">{t.name}</span>
                        {t.required_before_start ? <StatusMark label="Required" tone="red" className="ml-2" /> : null}
                        <span className="block text-xs text-muted-foreground">
                          {taskTypeLabel(t.task_type)}
                          {t.document_requirement_name ? `: files ${t.document_requirement_name}` : ""}
                        </span>
                        {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
                      </td>
                      <td className="text-xs">{assigneeLabel(t.assignee_kind, t.assignee_role)}</td>
                      <td className="whitespace-nowrap text-right text-xs tabular-nums">+{t.due_days_after_hire}d</td>
                      <td className="whitespace-nowrap text-right">
                        <button type="button" className={linkCaps} disabled={pending} onClick={() => setEditing(t.id)}>
                          Edit<span className="sr-only"> {t.name}</span>
                        </button>
                        <button
                          type="button"
                          className={`${linkCaps} ml-3`}
                          disabled={pending}
                          onClick={() => {
                            if (window.confirm(`Remove "${t.name}" from the checklist? Hires already under way keep it.`)) {
                              run(() => deleteTaskAction(checklist.id, t.id));
                            }
                          }}
                        >
                          Remove<span className="sr-only"> {t.name}</span>
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Add a task" className="rounded-lg border border-border bg-card p-4">
        <h2 className="section-title mb-3">Add Task</h2>
        <TaskForm checklistId={checklist.id} requirements={requirements} />
      </section>
    </div>
  );
}

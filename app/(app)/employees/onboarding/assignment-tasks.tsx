import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import type { AssignmentDetail, TaskStatus } from "@/lib/api/onboarding";
import { localDate } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";
import { TASK_STATUS_LABEL, assigneeLabel, taskTypeLabel } from "@/lib/onboarding/options";

import { TaskActions } from "./task-actions";

const TONE: Record<TaskStatus, StatusTone> = {
  pending: "yellow",
  in_progress: "blue",
  complete: "green",
  skipped: "gray",
};

/** One hire's onboarding tasks (#180), legacy's assignment table: the task,
 *  its type, who it falls to, when it's due and where it stands, with what
 *  the reader may do to it. When a task was done reads in the company's
 *  zone. */
export function AssignmentTasks({ assignment, zone }: { assignment: AssignmentDetail; zone: string }) {
  if (assignment.tasks.length === 0) {
    return <p className="text-sm text-muted-foreground">This onboarding has no tasks.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="ff-table w-full text-sm">
        <thead className="ff-thead">
          <tr>
            <th className="w-10">#</th>
            <th>Task</th>
            <th>Falls To</th>
            <th>Due</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {assignment.tasks.map((t, i) => (
            <tr key={t.id} className={t.overdue ? "border-l-[3px] border-l-status-red" : undefined}>
              <td className="text-xs text-muted-foreground">{i + 1}</td>
              <td className="min-w-[220px]">
                <span className="font-semibold">{t.name}</span>
                {t.required_before_start ? <StatusMark label="Required" tone="red" className="ml-2" /> : null}
                <span className="block text-xs text-muted-foreground">{taskTypeLabel(t.task_type)}</span>
                {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
                {t.document ? (
                  <span className="block text-xs">
                    Filed in Documents: {t.document.original_filename}
                    {t.document.expires_on ? `, expires ${formatIsoDay(t.document.expires_on)}` : ""}
                  </span>
                ) : t.document_requirement && t.status !== "skipped" ? (
                  <span className="block text-xs text-muted-foreground">Files {t.document_requirement.name}</span>
                ) : null}
              </td>
              <td className="text-xs">{assigneeLabel(t.assignee_kind, t.assignee_role, assignment.supervisor?.full_name)}</td>
              <td className={t.overdue ? "whitespace-nowrap text-xs font-semibold text-status-red" : "whitespace-nowrap text-xs"}>
                {t.due_date ? formatIsoDay(t.due_date) : "—"}
                {t.overdue ? <span className="block">Overdue</span> : null}
              </td>
              <td className="text-xs">
                <StatusMark label={TASK_STATUS_LABEL[t.status]} tone={TONE[t.status]} />
                {t.completed_at ? (
                  <span className="mt-1 block text-muted-foreground">
                    {t.completed_by_name ?? "—"}, {localDate(t.completed_at, zone)}
                  </span>
                ) : null}
                {t.completion_notes ? <span className="mt-1 block text-muted-foreground">{t.completion_notes}</span> : null}
              </td>
              <td className="text-right">
                <TaskActions assignmentId={assignment.id} task={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

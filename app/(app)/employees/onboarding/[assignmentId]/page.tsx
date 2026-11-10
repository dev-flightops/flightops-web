import Link from "next/link";
import { notFound } from "next/navigation";

import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { StatusMark } from "@/components/ff/status-mark";
import { listStaff, loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getAssignment, type AssignmentDetail } from "@/lib/api/onboarding";
import { formatIsoDay } from "@/lib/iso-day";

import { AssignmentTasks } from "../assignment-tasks";
import { ProgressBar } from "../progress-bar";
import { AssignmentControls } from "./assignment-controls";

/**
 * /employees/onboarding/[assignmentId] (#180), legacy's
 * templates/onboarding_checklist/assignment.html: one new hire's tasks,
 * each logged done, started, skipped with a reason or reopened.
 *
 * For whoever runs onboarding, the new hire, and anyone with a task on it.
 */

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<AssignmentDetail["status"], string> = {
  in_progress: "In progress",
  complete: "Complete",
  archived: "Archived",
};

export default async function AssignmentPage({ params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  let assignment: AssignmentDetail;
  try {
    assignment = await getAssignment(assignmentId);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    const message =
      err instanceof ApiError && err.status === 403
        ? "Nothing on this onboarding falls to you."
        : err instanceof ApiError && err.status === 401
          ? "Your session expired — please sign in again."
          : "This onboarding is unavailable. Try refreshing in a moment.";
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeader title="Onboarding" back={{ href: "/employees/onboarding/my-tasks", label: "My Tasks" }} />
        <Notice tone="yellow" role="alert">
          {message}
        </Notice>
      </div>
    );
  }

  const [zones, staff] = await Promise.all([
    loadZoneTable().catch(() => null),
    assignment.can_manage
      ? listStaff()
          .then((s) => s.items)
          .catch(() => [])
      : Promise.resolve([]),
  ]);
  const zone = zones?.fallback ?? "America/Anchorage";
  const p = assignment.progress;
  const required = assignment.tasks.filter((t) => t.required_before_start && t.status !== "complete" && t.status !== "skipped");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={assignment.employee.full_name}
        back={
          assignment.can_manage
            ? { href: "/employees/onboarding", label: "Onboarding" }
            : { href: "/employees/onboarding/my-tasks", label: "My Tasks" }
        }
        description={
          <>
            {assignment.checklist_name}
            {assignment.employee.title ? ` · ${assignment.employee.title}` : ""} · hired {formatIsoDay(assignment.hire_date)}
          </>
        }
        actions={
          <StatusMark
            label={STATUS_LABEL[assignment.status]}
            tone={assignment.status === "complete" ? "green" : assignment.status === "archived" ? "gray" : "blue"}
          />
        }
      />

      <StatStrip label="Progress" className="mb-3">
        <Stat label="Done" value={`${p.pct}%`} />
        <Stat label="Tasks" value={`${p.done} / ${p.total}`} />
        <Stat label="Overdue" value={p.overdue} tone={p.overdue > 0 ? "red" : undefined} />
        <Stat label="Required Open" value={p.required_open} tone={p.required_open > 0 ? "red" : undefined} />
      </StatStrip>
      <ProgressBar pct={p.pct} overdue={p.overdue} className="mb-6" />

      {required.length > 0 ? (
        <Notice tone="red" label="Before starting" role="status" className="mb-6">
          Still to do before {assignment.employee.full_name} starts: {required.map((t) => t.name).join(", ")}. Shown, not
          enforced: their login can be switched on.
        </Notice>
      ) : null}
      {assignment.status === "archived" ? (
        <Notice tone="gray" className="mb-6">
          This onboarding is archived. Bring it back to change its tasks.
        </Notice>
      ) : null}

      <AssignmentTasks assignment={assignment} zone={zone} />

      {assignment.notes ? <p className="mt-4 text-sm text-muted-foreground">Notes: {assignment.notes}</p> : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Assigned by {assignment.assigned_by_name ?? "—"}. Documents filed by its tasks are in the employee&apos;s{" "}
        <Link href={`/employees/${assignment.employee.id}?tab=documents`} className="underline">
          Documents
        </Link>
        .
      </p>

      {assignment.can_manage ? (
        <Panel title="Manage" className="mt-8">
          <AssignmentControls assignment={assignment} staff={staff} />
        </Panel>
      ) : null}
    </div>
  );
}

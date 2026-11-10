import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { Panel } from "@/components/ff/panel";
import { StatusMark } from "@/components/ff/status-mark";
import type { StaffMember } from "@/lib/api/auth";
import type { ChecklistSummary, EmployeeOnboarding } from "@/lib/api/onboarding";
import { formatIsoDay } from "@/lib/iso-day";

import { AssignForm } from "../onboarding/assign-form";
import { AssignmentTasks } from "../onboarding/assignment-tasks";
import { ProgressBar } from "../onboarding/progress-bar";

/**
 * The employee record's Onboarding tab (#180), legacy's
 * templates/onboarding_checklist/employee.html: the checklists assigned to
 * this person, the tasks of those under way, what's still required before
 * they start, and the form to assign another.
 */
export function OnboardingPanel({
  onboarding,
  loadError,
  checklists,
  staff,
  zone,
}: {
  onboarding: EmployeeOnboarding | null;
  loadError: string | null;
  checklists: ChecklistSummary[];
  staff: StaffMember[];
  zone: string;
}) {
  if (!onboarding) {
    return (
      <Notice tone="yellow" role="alert">
        {loadError ?? "Onboarding is unavailable. Try refreshing in a moment."}
      </Notice>
    );
  }
  const required = onboarding.assignments
    .filter((a) => a.status === "in_progress")
    .flatMap((a) => a.tasks.filter((t) => t.required_before_start && t.status !== "complete" && t.status !== "skipped"));

  return (
    <div className="space-y-6">
      {required.length > 0 ? (
        <Notice tone="red" label="Before starting" role="status">
          Still to do: {required.map((t) => t.name).join(", ")}. Shown, not enforced: the login can be switched on.
        </Notice>
      ) : null}

      {onboarding.assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No onboarding assigned to {onboarding.employee.full_name} yet.</p>
      ) : (
        onboarding.assignments.map((a) => (
          <section key={a.id} aria-label={a.checklist_name} className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="section-title">{a.checklist_name}</h2>
                <p className="text-xs text-muted-foreground">
                  Hired {formatIsoDay(a.hire_date)} · {a.progress.done}/{a.progress.total} done
                  {a.progress.overdue > 0 ? ` · ${a.progress.overdue} overdue` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusMark
                  label={a.status === "in_progress" ? "In progress" : a.status === "complete" ? "Complete" : "Archived"}
                  tone={a.status === "complete" ? "green" : a.status === "archived" ? "gray" : "blue"}
                />
                <Link href={`/employees/onboarding/${a.id}`} className={linkCaps}>
                  Open<span className="sr-only"> {a.checklist_name}</span> <span aria-hidden>›</span>
                </Link>
              </div>
            </div>
            <ProgressBar pct={a.progress.pct} overdue={a.progress.overdue} />
            {a.status === "in_progress" ? <AssignmentTasks assignment={a} zone={zone} /> : null}
          </section>
        ))
      )}

      {onboarding.can_manage ? (
        <Panel title="Assign a Checklist">
          <AssignForm
            checklists={checklists}
            staff={staff}
            employee={{ id: onboarding.employee.id, full_name: onboarding.employee.full_name }}
          />
        </Panel>
      ) : null}
    </div>
  );
}

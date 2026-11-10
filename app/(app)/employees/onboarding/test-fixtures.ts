/** Onboarding records for tests (#180). Imported by tests only. */

import type { AssignmentDetail, AssignmentTask, MyOnboardingTask } from "@/lib/api/onboarding";

export function task(over: Partial<AssignmentTask> = {}): AssignmentTask {
  return {
    id: "t-1",
    name: "Read the GOM",
    description: null,
    task_type: "other",
    assignee_kind: "employee",
    assignee_role: null,
    document_requirement: null,
    required_before_start: false,
    sort_order: 10,
    due_date: "2026-11-16",
    status: "pending",
    overdue: false,
    completed_at: null,
    completed_by_name: null,
    completion_notes: null,
    document: null,
    can_act: true,
    ...over,
  };
}

export function assignment(over: Partial<AssignmentDetail> = {}): AssignmentDetail {
  return {
    id: "a-1",
    employee: { id: "u-9", full_name: "Nina Hale", title: "First Officer", department: null, is_active: true },
    checklist_id: "c-1",
    checklist_name: "New Hire Pilot",
    hire_date: "2026-11-02",
    status: "in_progress",
    supervisor: { id: "u-2", full_name: "Carl Chief", title: null, department: null, is_active: true },
    assigned_by_name: "Docs Admin",
    assigned_at: "2026-11-02T17:00:00Z",
    completed_at: null,
    notes: null,
    progress: { total: 3, done: 1, overdue: 1, required_open: 1, pct: 33 },
    tasks: [
      task({ id: "t-1", name: "Background check", assignee_kind: "hr", required_before_start: true, overdue: true, due_date: "2026-11-02" }),
      task({ id: "t-2", name: "Ramp tour", assignee_kind: "supervisor" }),
      task({
        id: "t-3",
        name: "Company email",
        assignee_kind: "it",
        status: "complete",
        completed_at: "2026-11-03T05:30:00Z",
        completed_by_name: "Docs Admin",
      }),
    ],
    can_manage: true,
    ...over,
  };
}

export function myTask(over: Partial<MyOnboardingTask> = {}): MyOnboardingTask {
  return {
    ...task(),
    assignment_id: "a-1",
    employee: { id: "u-9", full_name: "Nina Hale", title: null, department: null, is_active: true },
    checklist_name: "New Hire Pilot",
    ...over,
  };
}

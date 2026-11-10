/**
 * Employee onboarding's words (#180): legacy's task types and assignee
 * kinds, in its order, and how a task's owner reads on a page.
 *
 * FlightOps has no HR or IT role. HR tasks fall to whoever runs onboarding,
 * IT tasks to the Executive Admins, as the documents service resolves them
 * (app/onboarding/assignees.py).
 */

import type { AssigneeKind, OnboardingTaskType, TaskStatus } from "@/lib/api/onboarding";
import { formatRole } from "@/lib/roles";

export const TASK_TYPES: { value: OnboardingTaskType; label: string }[] = [
  { value: "document_upload", label: "Document Upload" },
  { value: "form_completion", label: "Form Completion" },
  { value: "training_assignment", label: "Training Assignment" },
  { value: "system_access_grant", label: "System Access Grant" },
  { value: "physical_action", label: "Physical Action" },
  { value: "supervisor_signoff", label: "Supervisor Sign-Off" },
  { value: "other", label: "Other" },
];

export const ASSIGNEE_KINDS: { value: AssigneeKind; label: string; hint: string }[] = [
  { value: "hr", label: "HR", hint: "Whoever runs onboarding" },
  { value: "it", label: "IT", hint: "The Executive Admins" },
  { value: "supervisor", label: "Supervisor", hint: "The supervisor named when it's assigned" },
  { value: "employee", label: "Employee", hint: "The new hire" },
  {
    value: "manager",
    label: "Manager / Exec",
    hint: "Exec Admin, Director of Operations, Chief Pilot, Director of Maintenance",
  },
  { value: "custom", label: "Specific Role", hint: "Everyone with the role picked" },
];

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  complete: "Complete",
  skipped: "Skipped",
};

export function taskTypeLabel(value: string): string {
  return TASK_TYPES.find((t) => t.value === value)?.label ?? value;
}

/** Who a task falls to, in words: "Employee", "Supervisor: Carl Chief",
 *  "Role: Chief Pilot". */
export function assigneeLabel(kind: AssigneeKind, role: string | null, supervisorName?: string | null): string {
  if (kind === "custom") return role ? `Role: ${formatRole(role)}` : "Specific Role";
  if (kind === "supervisor") return supervisorName ? `Supervisor: ${supervisorName}` : "Supervisor";
  return ASSIGNEE_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

export function isDone(status: TaskStatus): boolean {
  return status === "complete" || status === "skipped";
}

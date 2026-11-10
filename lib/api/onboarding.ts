/**
 * Employee onboarding (#180): checklists a company builds and assigns to a
 * new hire, each task due a number of days after the hire date. The
 * documents service's /onboarding.
 *
 * Run by the Executive Admin, Director of Operations, Chief Pilot, Director
 * of Maintenance and Safety Officer (ONBOARDING_ADMINS, Greg 10 Nov); a task
 * can also be worked by the person it falls to. A Document Upload task files
 * its document in the employee's Documents.
 */

import { apiFetch } from "./client";

export type OnboardingTaskType =
  | "document_upload"
  | "form_completion"
  | "training_assignment"
  | "system_access_grant"
  | "physical_action"
  | "supervisor_signoff"
  | "other";
export type AssigneeKind = "hr" | "it" | "supervisor" | "employee" | "manager" | "custom";
export type TaskStatus = "pending" | "in_progress" | "complete" | "skipped";
export type AssignmentStatus = "in_progress" | "complete" | "archived";
export type AssignmentView = "active" | "complete" | "archived";

export interface ChecklistTask {
  id: string;
  name: string;
  description: string | null;
  task_type: OnboardingTaskType;
  assignee_kind: AssigneeKind;
  assignee_role: string | null;
  document_requirement_id: string | null;
  document_requirement_name: string | null;
  due_days_after_hire: number;
  required_before_start: boolean;
  sort_order: number;
  notes: string | null;
}

export interface ChecklistSummary {
  id: string;
  name: string;
  description: string | null;
  target_role: string | null;
  is_active: boolean;
  task_count: number;
  in_progress_count: number;
  created_at: string;
}

export interface ChecklistDetail extends ChecklistSummary {
  tasks: ChecklistTask[];
}

export interface TaskInput {
  name: string;
  description: string | null;
  task_type: OnboardingTaskType;
  assignee_kind: AssigneeKind;
  assignee_role: string | null;
  document_requirement_id: string | null;
  due_days_after_hire: number;
  required_before_start: boolean;
  notes: string | null;
}

export interface OnboardingPerson {
  id: string;
  full_name: string;
  title: string | null;
  department: string | null;
  is_active: boolean;
}

export interface OnboardingProgress {
  total: number;
  done: number;
  overdue: number;
  /** Tasks required before starting that aren't done. */
  required_open: number;
  pct: number;
}

export interface AssignmentTask {
  id: string;
  name: string;
  description: string | null;
  task_type: OnboardingTaskType;
  assignee_kind: AssigneeKind;
  assignee_role: string | null;
  document_requirement: { id: string; name: string; has_expiry: boolean } | null;
  required_before_start: boolean;
  sort_order: number;
  due_date: string | null;
  status: TaskStatus;
  overdue: boolean;
  completed_at: string | null;
  completed_by_name: string | null;
  completion_notes: string | null;
  /** What a Document Upload task filed in the employee's Documents. */
  document: { id: string; original_filename: string; expires_on: string | null } | null;
  /** The caller may change it: it falls to them, or they run onboarding. */
  can_act: boolean;
}

export interface AssignmentSummary {
  id: string;
  employee: OnboardingPerson;
  checklist_id: string;
  checklist_name: string;
  hire_date: string;
  status: AssignmentStatus;
  supervisor: OnboardingPerson | null;
  assigned_by_name: string | null;
  assigned_at: string;
  completed_at: string | null;
  notes: string | null;
  progress: OnboardingProgress;
}

export interface AssignmentDetail extends AssignmentSummary {
  tasks: AssignmentTask[];
  /** The caller runs onboarding: archive, supervisor. */
  can_manage: boolean;
}

export interface EmployeeOnboarding {
  employee: OnboardingPerson;
  hire_date: string | null;
  assignments: AssignmentDetail[];
  can_manage: boolean;
}

export interface MyOnboardingTask extends AssignmentTask {
  assignment_id: string;
  employee: OnboardingPerson;
  checklist_name: string;
}

export interface RequiredOpen {
  employees: {
    employee: OnboardingPerson;
    tasks: { id: string; name: string; assignment_id: string; due_date: string | null }[];
  }[];
}

// ---- Checklists ------------------------------------------------------------

export async function listChecklists(includeArchived = false): Promise<ChecklistSummary[]> {
  return apiFetch<ChecklistSummary[]>(`/onboarding/checklists${includeArchived ? "?include_archived=true" : ""}`);
}

export async function getChecklist(id: string): Promise<ChecklistDetail> {
  return apiFetch<ChecklistDetail>(`/onboarding/checklists/${id}`);
}

export async function createChecklist(body: {
  name: string;
  description: string | null;
  target_role: string | null;
}): Promise<ChecklistDetail> {
  return apiFetch<ChecklistDetail>(`/onboarding/checklists`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateChecklist(
  id: string,
  body: Partial<{ name: string; description: string | null; target_role: string | null; is_active: boolean }>,
): Promise<ChecklistDetail> {
  return apiFetch<ChecklistDetail>(`/onboarding/checklists/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function duplicateChecklist(id: string): Promise<ChecklistDetail> {
  return apiFetch<ChecklistDetail>(`/onboarding/checklists/${id}/duplicate`, { method: "POST" });
}

export async function addChecklistTask(id: string, body: TaskInput): Promise<ChecklistTask> {
  return apiFetch<ChecklistTask>(`/onboarding/checklists/${id}/tasks`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateChecklistTask(taskId: string, body: Partial<TaskInput>): Promise<ChecklistTask> {
  return apiFetch<ChecklistTask>(`/onboarding/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function deleteChecklistTask(taskId: string): Promise<void> {
  await apiFetch<void>(`/onboarding/tasks/${taskId}`, { method: "DELETE" });
}

export async function reorderChecklistTasks(id: string, taskIds: string[]): Promise<ChecklistDetail> {
  return apiFetch<ChecklistDetail>(`/onboarding/checklists/${id}/order`, {
    method: "PUT",
    body: JSON.stringify({ task_ids: taskIds }),
  });
}

// ---- Assignments ------------------------------------------------------------

export async function listAssignments(view: AssignmentView = "active"): Promise<AssignmentSummary[]> {
  return apiFetch<AssignmentSummary[]>(`/onboarding/assignments?view=${view}`);
}

export async function getAssignment(id: string): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/onboarding/assignments/${id}`);
}

export async function getEmployeeOnboarding(employeeId: string): Promise<EmployeeOnboarding> {
  return apiFetch<EmployeeOnboarding>(`/onboarding/employees/${employeeId}`);
}

export async function assignChecklist(
  employeeId: string,
  body: { checklist_id: string; hire_date: string | null; supervisor_user_id: string | null; notes: string | null },
): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/onboarding/employees/${employeeId}/assignments`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function updateAssignment(
  id: string,
  body: Partial<{ status: "in_progress" | "archived"; supervisor_user_id: string | null; notes: string | null }>,
): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/onboarding/assignments/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export async function setTaskStatus(
  taskId: string,
  body: { status: TaskStatus; notes: string | null },
): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/onboarding/task-instances/${taskId}/status`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** A Document Upload task's file, as multipart: filed in Documents. */
export async function fileTaskDocument(taskId: string, form: FormData): Promise<AssignmentDetail> {
  return apiFetch<AssignmentDetail>(`/onboarding/task-instances/${taskId}/document`, { method: "POST", body: form });
}

// ---- A person's own, and who isn't ready ------------------------------------

export async function listMyOnboardingTasks(): Promise<{ items: MyOnboardingTask[] }> {
  return apiFetch<{ items: MyOnboardingTask[] }>(`/onboarding/my-tasks`);
}

export async function listRequiredOpen(): Promise<RequiredOpen> {
  return apiFetch<RequiredOpen>(`/onboarding/required-open`);
}

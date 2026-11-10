"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import {
  addChecklistTask,
  assignChecklist,
  createChecklist,
  deleteChecklistTask,
  duplicateChecklist,
  fileTaskDocument,
  reorderChecklistTasks,
  setTaskStatus,
  updateAssignment,
  updateChecklist,
  updateChecklistTask,
  type TaskInput,
  type TaskStatus,
} from "@/lib/api/onboarding";
import { refusalText } from "@/lib/api/validation-errors";

/**
 * Employee onboarding from the web (#180): build checklists, assign one to a
 * new hire, and work their tasks.
 *
 * Directly callable rather than `useActionState` form actions, as the
 * Documents tab's upload: a component using that hook can't render under
 * jsdom here, and its logic would go untested. Each returns what happened,
 * so the page can say it.
 */

export type OnboardingResult = { ok: true; id?: string } | { ok: false; message: string; errors?: Record<string, string> };

const RUNS_IT =
  "Onboarding is run by the Exec Admin, Director of Operations, Chief Pilot, Director of Maintenance and Safety Officer.";

/** The service's own sentence, not a code such as "insufficient_role". */
function sentence(err: ApiError): string | null {
  try {
    const detail = (JSON.parse(err.message) as { detail?: unknown }).detail;
    return typeof detail === "string" && detail.includes(" ") ? detail : null;
  } catch {
    return null;
  }
}

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    const own = refusalText(err);
    // The service's refusals say who may and why; a bare role code doesn't.
    if (err.status === 403) return sentence(err) ?? RUNS_IT;
    if (err.status === 404) return own ?? "That isn't on file any more — refresh the page.";
    if (err.status === 413) return "That file is too large — the limit is 25 MB.";
    return own ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function refresh(...paths: string[]) {
  revalidatePath("/employees/onboarding");
  revalidatePath("/employees/onboarding/my-tasks");
  revalidatePath("/home");
  for (const p of paths) revalidatePath(p);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

const TASK_TYPES = [
  "document_upload",
  "form_completion",
  "training_assignment",
  "system_access_grant",
  "physical_action",
  "supervisor_signoff",
  "other",
] as const;
const KINDS = ["hr", "it", "supervisor", "employee", "manager", "custom"] as const;

const TaskSchema = z
  .object({
    name: z.string().trim().min(1, "Give the task a name.").max(300),
    description: optional,
    task_type: z.enum(TASK_TYPES, { errorMap: () => ({ message: "Pick a type." }) }),
    assignee_kind: z.enum(KINDS, { errorMap: () => ({ message: "Pick who does it." }) }),
    assignee_role: optional,
    document_requirement_id: optional,
    due_days_after_hire: z.coerce
      .number({ invalid_type_error: "Give a number of days." })
      .int("Whole days.")
      .min(0, "Zero or more days.")
      .max(3650, "Ten years at most."),
    required_before_start: z.boolean(),
    notes: optional,
  })
  .superRefine((t, ctx) => {
    if (t.assignee_kind === "custom" && !t.assignee_role) {
      ctx.addIssue({ code: "custom", path: ["assignee_role"], message: "Pick the role it falls to." });
    }
    if (t.task_type === "document_upload" && !t.document_requirement_id) {
      ctx.addIssue({ code: "custom", path: ["document_requirement_id"], message: "Pick the document it files." });
    }
  });

function fieldErrors(issues: z.ZodIssue[]): OnboardingResult {
  const errors: Record<string, string> = {};
  for (const issue of issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
  return { ok: false, message: "Check the highlighted fields.", errors };
}

/** A task as its form sends it: the role only for a Specific Role task, the
 *  document only for a Document Upload one. */
function taskInput(raw: Record<string, unknown>): { input: TaskInput } | { result: OnboardingResult } {
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) return { result: fieldErrors(parsed.error.issues) };
  const t = parsed.data;
  return {
    input: {
      ...t,
      assignee_role: t.assignee_kind === "custom" ? t.assignee_role : null,
      document_requirement_id: t.task_type === "document_upload" ? t.document_requirement_id : null,
    },
  };
}

// ---- Checklists --------------------------------------------------------------

export async function createChecklistAction(raw: {
  name: string;
  description: string;
  target_role: string;
}): Promise<OnboardingResult> {
  const name = raw.name.trim();
  if (!name) return { ok: false, message: "Give the checklist a name.", errors: { name: "Give the checklist a name." } };
  try {
    const made = await createChecklist({
      name,
      description: raw.description.trim() || null,
      target_role: raw.target_role || null,
    });
    refresh("/employees/onboarding/checklists");
    return { ok: true, id: made.id };
  } catch (err) {
    return { ok: false, message: refusal(err, "create the checklist") };
  }
}

export async function updateChecklistAction(
  id: string,
  raw: Partial<{ name: string; description: string; target_role: string; is_active: boolean }>,
): Promise<OnboardingResult> {
  if (raw.name !== undefined && !raw.name.trim()) {
    return { ok: false, message: "Give the checklist a name.", errors: { name: "Give the checklist a name." } };
  }
  try {
    await updateChecklist(id, {
      ...(raw.name !== undefined ? { name: raw.name.trim() } : {}),
      ...(raw.description !== undefined ? { description: raw.description.trim() || null } : {}),
      ...(raw.target_role !== undefined ? { target_role: raw.target_role || null } : {}),
      ...(raw.is_active !== undefined ? { is_active: raw.is_active } : {}),
    });
    refresh("/employees/onboarding/checklists", `/employees/onboarding/checklists/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save the checklist") };
  }
}

export async function duplicateChecklistAction(id: string): Promise<OnboardingResult> {
  try {
    const copy = await duplicateChecklist(id);
    refresh("/employees/onboarding/checklists");
    return { ok: true, id: copy.id };
  } catch (err) {
    return { ok: false, message: refusal(err, "copy the checklist") };
  }
}

export async function addTaskAction(checklistId: string, raw: Record<string, unknown>): Promise<OnboardingResult> {
  const checked = taskInput(raw);
  if ("result" in checked) return checked.result;
  try {
    await addChecklistTask(checklistId, checked.input);
    refresh(`/employees/onboarding/checklists/${checklistId}`, "/employees/onboarding/checklists");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "add the task") };
  }
}

export async function updateTaskAction(
  checklistId: string,
  taskId: string,
  raw: Record<string, unknown>,
): Promise<OnboardingResult> {
  const checked = taskInput(raw);
  if ("result" in checked) return checked.result;
  try {
    await updateChecklistTask(taskId, checked.input);
    refresh(`/employees/onboarding/checklists/${checklistId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "save the task") };
  }
}

export async function deleteTaskAction(checklistId: string, taskId: string): Promise<OnboardingResult> {
  try {
    await deleteChecklistTask(taskId);
    refresh(`/employees/onboarding/checklists/${checklistId}`, "/employees/onboarding/checklists");
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "remove the task") };
  }
}

export async function reorderTasksAction(checklistId: string, taskIds: string[]): Promise<OnboardingResult> {
  try {
    await reorderChecklistTasks(checklistId, taskIds);
    refresh(`/employees/onboarding/checklists/${checklistId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "reorder the tasks") };
  }
}

// ---- Assignments ---------------------------------------------------------------

const AssignSchema = z.object({
  employee_id: z.string({ required_error: "Pick the new hire." }).trim().regex(UUID, "Pick the new hire."),
  checklist_id: z.string({ required_error: "Pick a checklist." }).trim().regex(UUID, "Pick a checklist."),
  hire_date: optional.refine((v) => v === null || DAY.test(v), "Give a date."),
  supervisor_user_id: optional.refine((v) => v === null || UUID.test(v), "Pick one from the list."),
  notes: optional,
});

export async function assignChecklistAction(raw: Record<string, string>): Promise<OnboardingResult> {
  const parsed = AssignSchema.safeParse(raw);
  if (!parsed.success) return fieldErrors(parsed.error.issues);
  const { employee_id, ...body } = parsed.data;
  try {
    const made = await assignChecklist(employee_id, body);
    refresh(`/employees/${employee_id}`);
    return { ok: true, id: made.id };
  } catch (err) {
    return { ok: false, message: refusal(err, "assign the checklist") };
  }
}

export async function updateAssignmentAction(
  assignmentId: string,
  body: Partial<{ status: "in_progress" | "archived"; supervisor_user_id: string | null }>,
): Promise<OnboardingResult> {
  try {
    const detail = await updateAssignment(assignmentId, body);
    refresh(`/employees/onboarding/${assignmentId}`, `/employees/${detail.employee.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "change the onboarding") };
  }
}

export async function setTaskStatusAction(
  assignmentId: string,
  taskId: string,
  status: TaskStatus,
  notes: string,
): Promise<OnboardingResult> {
  if (status === "skipped" && !notes.trim()) return { ok: false, message: "Say why it's skipped." };
  try {
    const detail = await setTaskStatus(taskId, { status, notes: notes.trim() || null });
    refresh(`/employees/onboarding/${assignmentId}`, `/employees/${detail.employee.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "update the task") };
  }
}

/** A Document Upload task's file: forwarded as multipart, filed in the
 *  employee's Documents by the service. */
export async function fileTaskDocumentAction(
  assignmentId: string,
  taskId: string,
  form: FormData,
): Promise<OnboardingResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a file to upload." };
  const outbound = new FormData();
  outbound.append("file", file, file.name);
  for (const field of ["issued_on", "expires_on", "notes"] as const) {
    const value = String(form.get(field) ?? "").trim();
    if (value) outbound.append(field, value);
  }
  try {
    const detail = await fileTaskDocument(taskId, outbound);
    refresh(`/employees/onboarding/${assignmentId}`, `/employees/${detail.employee.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: refusal(err, "upload the document") };
  }
}

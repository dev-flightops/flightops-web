import { beforeEach, describe, expect, it, vi } from "vitest";

const { TestApiError, api } = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(
      public status: number,
      public path: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    TestApiError,
    api: {
      addChecklistTask: vi.fn(),
      assignChecklist: vi.fn(),
      createChecklist: vi.fn(),
      deleteChecklistTask: vi.fn(),
      duplicateChecklist: vi.fn(),
      fileTaskDocument: vi.fn(),
      reorderChecklistTasks: vi.fn(),
      setTaskStatus: vi.fn(),
      updateAssignment: vi.fn(),
      updateChecklist: vi.fn(),
      updateChecklistTask: vi.fn(),
    },
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/onboarding", () => api);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  addTaskAction,
  assignChecklistAction,
  createChecklistAction,
  fileTaskDocumentAction,
  setTaskStatusAction,
} from "./actions";

const UUID = "4f9c3a2e-1b7d-4c8e-9a6f-2d5e8b1c7a30";
const TASK = {
  name: "Upload pilot certificate",
  description: "",
  task_type: "other",
  assignee_kind: "employee",
  assignee_role: "",
  document_requirement_id: "",
  due_days_after_hire: "7",
  required_before_start: false,
  notes: "",
};

beforeEach(() => vi.clearAllMocks());

describe("a checklist task from its form (#180)", () => {
  it("sends the role only for a Specific Role task and the document only for an upload", async () => {
    api.addChecklistTask.mockResolvedValueOnce({});
    const ok = await addTaskAction("c-1", { ...TASK, assignee_role: "dispatcher", document_requirement_id: UUID });
    expect(ok).toEqual({ ok: true });
    expect(api.addChecklistTask).toHaveBeenCalledWith("c-1", {
      name: "Upload pilot certificate",
      description: null,
      task_type: "other",
      assignee_kind: "employee",
      assignee_role: null,
      document_requirement_id: null,
      due_days_after_hire: 7,
      required_before_start: false,
      notes: null,
    });
  });

  it("asks for the role of a Specific Role task and the document of an upload", async () => {
    const role = await addTaskAction("c-1", { ...TASK, assignee_kind: "custom" });
    expect(role.ok ? null : role.errors?.assignee_role).toBe("Pick the role it falls to.");
    const doc = await addTaskAction("c-1", { ...TASK, task_type: "document_upload" });
    expect(doc.ok ? null : doc.errors?.document_requirement_id).toBe("Pick the document it files.");
    const days = await addTaskAction("c-1", { ...TASK, due_days_after_hire: "-1" });
    expect(days.ok ? null : days.errors?.due_days_after_hire).toBe("Zero or more days.");
    expect(api.addChecklistTask).not.toHaveBeenCalled();
  });

  it("passes on what the service says, and says who runs onboarding for a bare refusal", async () => {
    api.addChecklistTask.mockRejectedValueOnce(
      new TestApiError(422, "/onboarding", JSON.stringify({ detail: "That document requirement isn't in use." })),
    );
    expect(await addTaskAction("c-1", TASK)).toEqual({ ok: false, message: "That document requirement isn't in use." });
    api.addChecklistTask.mockRejectedValueOnce(new TestApiError(403, "/onboarding", JSON.stringify({ detail: "insufficient_role" })));
    const refused = await addTaskAction("c-1", TASK);
    expect(refused.ok ? "" : refused.message).toMatch(/run by the Exec Admin, Director of Operations, Chief Pilot/);
  });
});

describe("assigning and working tasks (#180)", () => {
  it("needs the new hire and a checklist, and sends blanks as nothing", async () => {
    const missing = await assignChecklistAction({ employee_id: "", checklist_id: "" });
    expect(missing.ok ? {} : missing.errors).toEqual({ employee_id: "Pick the new hire.", checklist_id: "Pick a checklist." });
    api.assignChecklist.mockResolvedValueOnce({ id: "a-9" });
    const made = await assignChecklistAction({ employee_id: UUID, checklist_id: UUID, hire_date: "", supervisor_user_id: "", notes: "" });
    expect(made).toEqual({ ok: true, id: "a-9" });
    expect(api.assignChecklist).toHaveBeenCalledWith(UUID, {
      checklist_id: UUID,
      hire_date: null,
      supervisor_user_id: null,
      notes: null,
    });
  });

  it("won't skip a task without a reason", async () => {
    expect(await setTaskStatusAction("a-1", "t-1", "skipped", "  ")).toEqual({ ok: false, message: "Say why it's skipped." });
    expect(api.setTaskStatus).not.toHaveBeenCalled();
    api.setTaskStatus.mockResolvedValueOnce({ employee: { id: "u-9" } });
    expect(await setTaskStatusAction("a-1", "t-1", "skipped", "Done at the last carrier")).toEqual({ ok: true });
    expect(api.setTaskStatus).toHaveBeenCalledWith("t-1", { status: "skipped", notes: "Done at the last carrier" });
  });

  it("forwards an upload's file and dates, and needs a file", async () => {
    const empty = new FormData();
    expect(await fileTaskDocumentAction("a-1", "t-1", empty)).toEqual({ ok: false, message: "Choose a file to upload." });
    const form = new FormData();
    form.append("file", new File(["%PDF"], "licence.pdf", { type: "application/pdf" }));
    form.append("expires_on", "2027-11-01");
    form.append("issued_on", "");
    api.fileTaskDocument.mockResolvedValueOnce({ employee: { id: "u-9" } });
    expect(await fileTaskDocumentAction("a-1", "t-1", form)).toEqual({ ok: true });
    const sent = api.fileTaskDocument.mock.calls[0][1] as FormData;
    expect((sent.get("file") as File).name).toBe("licence.pdf");
    expect(sent.get("expires_on")).toBe("2027-11-01");
    expect(sent.has("issued_on")).toBe(false);
    api.fileTaskDocument.mockRejectedValueOnce(new TestApiError(413, "/onboarding", "too big"));
    expect(await fileTaskDocumentAction("a-1", "t-1", form)).toEqual({ ok: false, message: "That file is too large — the limit is 25 MB." });
  });

  it("names a checklist before creating it", async () => {
    const blank = await createChecklistAction({ name: " ", description: "", target_role: "" });
    expect(blank.ok).toBe(false);
    api.createChecklist.mockResolvedValueOnce({ id: "c-2" });
    expect(await createChecklistAction({ name: "New Hire Pilot", description: "", target_role: "pilot" })).toEqual({ ok: true, id: "c-2" });
    expect(api.createChecklist).toHaveBeenCalledWith({ name: "New Hire Pilot", description: null, target_role: "pilot" });
  });
});

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
      createLesson: vi.fn(),
      createLessonQuiz: vi.fn(),
      addQuizQuestion: vi.fn(),
      readDocumentText: vi.fn(),
      startLessonDraft: vi.fn(),
      getLessonDraft: vi.fn(),
    },
  };
});
vi.mock("@/lib/api/client", () => ({ ApiError: TestApiError }));
vi.mock("@/lib/api/academy", () => ({
  createLesson: api.createLesson,
  createLessonQuiz: api.createLessonQuiz,
  addQuizQuestion: api.addQuizQuestion,
}));
vi.mock("@/lib/api/document-limits", () => ({ readDocumentText: api.readDocumentText }));
vi.mock("@/lib/api/lesson-drafts", () => ({
  startLessonDraft: api.startLessonDraft,
  getLessonDraft: api.getLessonDraft,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addDraftAction, startDraftAction } from "./draft-actions";

/** Starting a draft, and adding what the author kept (the bug doc's Section 6). */

const DONE = {
  id: "d1",
  status: "done",
  course_id: "c1",
  document_id: "doc1",
  document_title: "GOM",
  result: {
    lessons: [
      { title: "Clean wings", body_markdown: "Inspect.", pages: [2] },
      { title: "Holdover", body_markdown: "Two to five minutes.", pages: [3, 2] },
    ],
    quiz: {
      title: "De-icing check",
      questions: [{ prompt: "Who checks?", options: ["PIC", "Ramp"], correct_option: 0, explanation: "Page 2.", page: 2 }],
    },
  },
};

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  api.createLesson.mockImplementation(async (_course: string, input: { title: string }) => ({ id: `lesson-${input.title}` }));
  api.createLessonQuiz.mockResolvedValue({ id: "q1" });
  api.getLessonDraft.mockResolvedValue(DONE);
});

describe("starting a draft", () => {
  it("reads a document out first when its text hasn't been", async () => {
    api.readDocumentText.mockResolvedValue({ text_status: "extracted" });
    api.startLessonDraft.mockResolvedValue({ id: "d1", status: "running" });
    const result = await startDraftAction("c1", { documentId: "doc1", lessons: 9, quiz: true, focus: "  de-icing ", unread: true });
    expect(api.readDocumentText).toHaveBeenCalledWith("doc1");
    expect(api.startLessonDraft).toHaveBeenCalledWith({
      course_id: "c1",
      document_id: "doc1",
      lessons: 6,
      quiz: true,
      focus: "de-icing",
    });
    expect(result).toEqual({ draft: { id: "d1", status: "running" }, error: null });
  });

  it("says when the document has no text to read", async () => {
    api.readDocumentText.mockResolvedValue({ text_status: "no_text" });
    const result = await startDraftAction("c1", { documentId: "doc1", lessons: 3, quiz: false, focus: "", unread: true });
    expect(result.error).toMatch(/scan/);
    expect(api.startLessonDraft).not.toHaveBeenCalled();
  });

  it("puts the service's refusal in words", async () => {
    api.startLessonDraft.mockRejectedValue(new TestApiError(429, "/ai/lesson-drafts", '{"detail":"too_many_drafts"}'));
    const result = await startDraftAction("c1", { documentId: "doc1", lessons: 3, quiz: false, focus: "", unread: false });
    expect(result.error).toMatch(/hour/);
  });
});

describe("adding what was kept", () => {
  it("adds the kept lessons with their source, and the quiz on the last of them", async () => {
    const result = await addDraftAction("c1", "d1", { lessons: [1, 0, 1, 7, -1], quiz: true });
    expect(result).toEqual({ added: 2, error: null });
    expect(api.createLesson.mock.calls).toEqual([
      ["c1", { title: "Clean wings", body_markdown: "Inspect.\n\nDrafted from GOM, page 2. Check it against the document before publishing." }],
      [
        "c1",
        { title: "Holdover", body_markdown: "Two to five minutes.\n\nDrafted from GOM, pages 2 and 3. Check it against the document before publishing." },
      ],
    ]);
    expect(api.createLessonQuiz).toHaveBeenCalledWith("lesson-Holdover", { title: "De-icing check", pass_threshold: 80 });
    expect(api.addQuizQuestion).toHaveBeenCalledWith("q1", {
      prompt: "Who checks?",
      options: ["PIC", "Ramp"],
      correct_option_index: 0,
      explanation: "Page 2.",
    });
  });

  it("leaves the quiz out when it isn't kept", async () => {
    await addDraftAction("c1", "d1", { lessons: [0], quiz: false });
    expect(api.createLessonQuiz).not.toHaveBeenCalled();
  });

  it("adds nothing from a draft for another course, or one not done", async () => {
    expect((await addDraftAction("other", "d1", { lessons: [0], quiz: true })).added).toBe(0);
    api.getLessonDraft.mockResolvedValue({ ...DONE, status: "running", result: null });
    expect((await addDraftAction("c1", "d1", { lessons: [0], quiz: true })).error).toMatch(/isn't ready/);
    expect(api.createLesson).not.toHaveBeenCalled();
  });

  it("says how far it got when adding stops part-way", async () => {
    api.createLesson
      .mockResolvedValueOnce({ id: "l1" })
      .mockRejectedValueOnce(new TestApiError(500, "/academy/courses/c1/lessons", "oops"));
    const result = await addDraftAction("c1", "d1", { lessons: [0, 1], quiz: true });
    expect(result.added).toBe(1);
    expect(result.error).toMatch(/^1 lesson was added before it stopped/);
  });
});

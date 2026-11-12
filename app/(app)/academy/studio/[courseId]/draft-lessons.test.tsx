import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ startDraftAction: vi.fn(), addDraftAction: vi.fn() }));
vi.mock("./draft-actions", () => actions);
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import type { DraftDocument, LessonDraft } from "@/lib/api/lesson-drafts";

import { DraftLessons } from "./draft-lessons";

/** The studio's Draft lessons from a document (the bug doc's Section 6). */

const DOCS: DraftDocument[] = [
  { document_id: "doc1", title: "General Operations Manual", category: "Manuals", text_status: null, page_count: 120 },
];
const RUNNING = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "running",
  course_id: "c1",
  document_id: "doc1",
  document_title: "General Operations Manual",
  lessons_wanted: 2,
  with_quiz: true,
  focus: "de-icing",
  pages_read: [],
  partial: false,
  result: null,
  error: null,
  started_at: "x",
  finished_at: null,
} as LessonDraft;
const DONE: LessonDraft = {
  ...RUNNING,
  status: "done",
  pages_read: [2, 3],
  partial: true,
  result: {
    lessons: [
      { title: "Clean wings", body_markdown: "Inspect the wings.", pages: [2] },
      { title: "Holdover times", body_markdown: "Two to five minutes.", pages: [3] },
    ],
    quiz: {
      title: "De-icing check",
      questions: [{ prompt: "Who checks?", options: ["The PIC", "Ramp"], correct_option: 0, explanation: null, page: 2 }],
    },
  },
};
const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  actions.startDraftAction.mockReset();
  actions.addDraftAction.mockReset();
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function draftIt() {
  render(<DraftLessons courseId="c1" published documents={DOCS} />);
  fireEvent.click(screen.getByRole("button", { name: "Open" }));
  fireEvent.change(screen.getByPlaceholderText(/de-icing, or chapter 4/), { target: { value: "de-icing" } });
  fireEvent.click(screen.getByRole("button", { name: "Draft lessons" }));
  await screen.findByText(/This takes a minute or two/);
}

describe("drafting lessons from a document", () => {
  it("asks for the draft, reading the document out first, and shows it as it comes back", async () => {
    actions.startDraftAction.mockResolvedValue({ draft: RUNNING, error: null });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(DONE), { status: 200 }));
    await draftIt();
    expect(actions.startDraftAction).toHaveBeenCalledWith("c1", {
      documentId: "doc1",
      lessons: 3,
      quiz: true,
      focus: "de-icing",
      unread: true,
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/academy/lesson-drafts/${RUNNING.id}`, { cache: "no-store" });
    expect(await screen.findByText("Clean wings")).toBeInTheDocument();
    expect(screen.getByText(/reading pages 2 and 3 of it/)).toBeInTheDocument();
    expect(screen.getByText(/This course is published/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add 2 lessons and the quiz" })).toBeInTheDocument();
  });

  it("adds only the lessons kept, and says so", async () => {
    actions.startDraftAction.mockResolvedValue({ draft: RUNNING, error: null });
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(DONE), { status: 200 }));
    actions.addDraftAction.mockResolvedValue({ added: 1, error: null });
    await draftIt();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: /Holdover times/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /De-icing check/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add 1 lesson" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Added 1 lesson at the end of the course");
    expect(actions.addDraftAction).toHaveBeenCalledWith("c1", RUNNING.id, { lessons: [0], quiz: false });
    expect(refresh).toHaveBeenCalled();
  });

  it("goes back to the form, saying why, when the draft fails", async () => {
    actions.startDraftAction.mockResolvedValue({ draft: RUNNING, error: null });
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ ...RUNNING, status: "failed", error: "nothing_usable_came_back" }), { status: 200 }),
    );
    await draftIt();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/Nothing usable came back/);
    expect(screen.getByRole("button", { name: "Draft lessons" })).toBeInTheDocument();
  });

  it("counts a document's pages, and says when one is read as it's drafted", () => {
    render(
      <DraftLessons
        courseId="c1"
        published={false}
        documents={[...DOCS, { document_id: "doc2", title: "Icing bulletin", category: "Safety", text_status: "extracted", page_count: 1 }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("option", { name: "General Operations Manual (120 pages) — read when you draft" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Icing bulletin (1 page)" })).toBeInTheDocument();
  });

  it("says when there's nothing in the library to draft from", () => {
    render(<DraftLessons courseId="c1" published={false} documents={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText(/nothing in the document library to draft from/)).toBeInTheDocument();
  });
});

import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Lesson, LessonMedia, LessonMediaProgress } from "@/lib/api/academy";

const lists = vi.hoisted(() => ({ last: null as null | { enrollmentId: string | null; onFinished?: (id: string) => void } }));

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("./actions", () => ({ completeLessonAction: vi.fn() }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useActionState: () => [{ status: "idle" }, vi.fn(), false],
}));
vi.mock("@/components/academy/lesson-media", () => ({
  LessonMediaList: (props: { enrollmentId: string | null; onFinished?: (id: string) => void }) => {
    lists.last = props;
    return <div data-testid="media" />;
  },
}));

import { LessonPlayer } from "./lesson-player";

const video: LessonMedia = {
  id: "m1", lesson_id: "l1", ordinal: 0, kind: "video", title: "Icing", must_finish: true, source: "file",
  filename: "ice.mp4", size_bytes: 1, link_url: null, link_provider: null, link_ref: null, document_id: null,
};
const pdf: LessonMedia = { ...video, id: "m2", kind: "pdf", title: "Handout", filename: "h.pdf" };

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  id: "l1", course_id: "c1", ordinal: 0, title: "Winter", body_markdown: "Read this.", media: [], quiz_id: null,
  created_at: "", updated_at: "", ...over,
});

const finished = (mediaId: string): LessonMediaProgress => ({
  media_id: mediaId, position_seconds: 100, duration_seconds: 100, page: 0, page_count: null, finished: true, finished_at: "x",
});

function show(props: Partial<Parameters<typeof LessonPlayer>[0]> = {}) {
  return render(
    <LessonPlayer enrollmentId="e1" lesson={lesson()} lessonNumber={1} isDone={false} locked={false} quizPassed={false} {...props} />,
  );
}

const markComplete = () => screen.queryByRole("button", { name: "Mark Complete" });
const takeQuiz = () => screen.queryByRole("link", { name: /Take Quiz/ });

beforeEach(() => {
  lists.last = null;
});

describe("a text lesson", () => {
  it("is as it was", () => {
    show();
    expect(markComplete()).toBeInTheDocument();
    expect(screen.queryByTestId("media")).toBeNull();
  });

  it("with a quiz on the first lesson, offers the quiz", () => {
    show({ lesson: lesson({ quiz_id: "q1" }) });
    expect(takeQuiz()).toBeInTheDocument();
    expect(markComplete()).toBeNull();
  });
});

describe("what has to be finished", () => {
  it("holds back Mark Complete, and says what's left", () => {
    show({ lesson: lesson({ media: [video, pdf] }) });
    expect(markComplete()).toBeNull();
    expect(screen.getByText("Watch the video and page through the PDF to the end to continue.")).toBeInTheDocument();
  });

  it("holds back the quiz too", () => {
    show({ lesson: lesson({ media: [video], quiz_id: "q1" }) });
    expect(takeQuiz()).toBeNull();
    expect(screen.getByText("Watch the video to the end to continue.")).toBeInTheDocument();
  });

  it("lets go as each is finished, without a reload", () => {
    show({ lesson: lesson({ media: [video, pdf] }) });
    act(() => lists.last?.onFinished?.("m1"));
    expect(screen.getByText("Page through the PDF to the end to continue.")).toBeInTheDocument();
    act(() => lists.last?.onFinished?.("m2"));
    expect(markComplete()).toBeInTheDocument();
  });

  it("then the quiz opens", () => {
    show({ lesson: lesson({ media: [video], quiz_id: "q1" }) });
    act(() => lists.last?.onFinished?.("m1"));
    expect(takeQuiz()).toBeInTheDocument();
  });

  it("already finished stays finished", () => {
    show({ lesson: lesson({ media: [video] }), mediaProgress: [finished("m1")] });
    expect(markComplete()).toBeInTheDocument();
  });

  it("a reference document holds nothing back", () => {
    show({ lesson: lesson({ media: [{ ...pdf, must_finish: false }] }) });
    expect(markComplete()).toBeInTheDocument();
  });

  it("a lesson with only media doesn't say it has no content", () => {
    show({ lesson: lesson({ media: [video], body_markdown: "" }) });
    expect(screen.queryByText("No lesson content yet.")).toBeNull();
  });
});

describe("a quiz after earlier lessons", () => {
  it("waits for them, and says which", () => {
    show({ lesson: lesson({ quiz_id: "q1" }), earlierLessonsOpen: [1, 2] });
    expect(takeQuiz()).toBeNull();
    expect(screen.getByText(/opens once you've completed lessons 1 and 2/)).toBeInTheDocument();
  });

  it("doesn't hold back a lesson with no quiz", () => {
    show({ earlierLessonsOpen: [1] });
    expect(markComplete()).toBeInTheDocument();
  });

  it("doesn't take away a quiz already passed", () => {
    show({ lesson: lesson({ quiz_id: "q1" }), earlierLessonsOpen: [1], quizPassed: true });
    expect(markComplete()).toBeInTheDocument();
  });
});

describe("whose viewing it is", () => {
  it("the learner's is recorded", () => {
    show({ lesson: lesson({ media: [video] }) });
    expect(lists.last?.enrollmentId).toBe("e1");
  });

  it("an admin opening someone's enrollment isn't, and isn't told to watch", () => {
    show({ lesson: lesson({ media: [video] }), isEnrollee: false });
    expect(lists.last?.enrollmentId).toBeNull();
    expect(screen.queryByText(/to the end to continue/)).toBeNull();
  });

  it("a finished enrollment isn't", () => {
    show({ lesson: lesson({ media: [video] }), locked: true });
    expect(lists.last?.enrollmentId).toBeNull();
  });
});

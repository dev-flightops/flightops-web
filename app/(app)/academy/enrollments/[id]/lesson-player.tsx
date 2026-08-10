"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { Lesson } from "@/lib/api/academy";

import {
  completeLessonAction,
  type CompleteLessonState,
} from "./actions";

const _initial: CompleteLessonState = { status: "idle" };

/**
 * Lesson body + Mark Complete button. Body renders as a
 * pre-wrap block; we intentionally don't parse Markdown here —
 * a follow-up will wire react-markdown once the content stories
 * need it. For now the raw text preserves formatting well
 * enough for the demo.
 */
export function LessonPlayer({
  enrollmentId,
  lesson,
  isDone,
  locked,
  quizPassed,
}: {
  enrollmentId: string;
  lesson: Lesson;
  isDone: boolean;
  locked: boolean;
  /** True when the lesson has a quiz AND the learner already has a
   *  passing attempt. Only meaningful when lesson.quiz_id !== null;
   *  drives whether we show "Take Quiz" or "Mark Complete". */
  quizPassed: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    completeLessonAction,
    _initial,
  );

  return (
    <article>
      <header className="mb-4">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Lesson {String(lesson.ordinal + 1).padStart(2, "0")}
        </p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">
          {lesson.title}
        </h2>
      </header>

      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      {lesson.body_markdown ? (
        <div className="prose prose-invert prose-sm max-w-none whitespace-pre-wrap text-foreground/90">
          {lesson.body_markdown}
        </div>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          No lesson content yet.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
        {isDone ? (
          <span className="inline-flex items-center rounded border border-status-green/40 bg-status-green/10 px-2 py-1 text-xs font-semibold text-status-green">
            ✓ Completed
          </span>
        ) : locked ? (
          <span className="text-xs text-muted-foreground">
            Enrollment is not in progress — lessons can no longer be marked.
          </span>
        ) : lesson.quiz_id && !quizPassed ? (
          // Quiz-gated lesson: send the learner to the runner
          // first. Mark Complete is intentionally hidden — the
          // backend would 409 anyway (quiz_not_passed) and the
          // clearer path is to take the quiz.
          <div className="flex flex-col items-end gap-1">
            <Link
              href={`/academy/enrollments/${enrollmentId}/quiz/${lesson.quiz_id}?lesson=${lesson.id}`}
              className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              Take Quiz →
            </Link>
            <span className="text-[0.65rem] text-muted-foreground">
              A quiz gates this lesson — pass it to unlock Mark Complete.
            </span>
          </div>
        ) : (
          <form action={formAction} className="flex items-center gap-2">
            {lesson.quiz_id ? (
              <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                ✓ Quiz passed
              </span>
            ) : null}
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Mark Complete"}
            </button>
          </form>
        )}
      </div>
    </article>
  );
}

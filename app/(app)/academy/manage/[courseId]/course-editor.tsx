"use client";

import { useActionState, useState } from "react";

import type { CourseDetail, Lesson } from "@/lib/api/academy";

import {
  addLessonAction,
  type AdminActionState,
  deleteLessonAction,
  toggleActiveAction,
  updateLessonAction,
} from "./actions";

const _initial: AdminActionState = { status: "idle" };

export function CourseEditor({ course }: { course: CourseDetail }) {
  return (
    <div className="space-y-6">
      <ActiveToggle course={course} />
      <LessonList course={course} />
      <AddLessonForm courseId={course.id} />
    </div>
  );
}

function ActiveToggle({ course }: { course: CourseDetail }) {
  const [state, formAction, pending] = useActionState(
    toggleActiveAction,
    _initial,
  );
  const [isActive, setIsActive] = useState(course.is_active);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Visibility
      </h2>
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="course_id" value={course.id} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_active"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          <span>Active — visible in the public catalog</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}

function LessonList({ course }: { course: CourseDetail }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Lessons
      </h2>
      {course.lessons.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No lessons yet. Add one below to publish the course.
        </p>
      ) : (
        <ol className="space-y-2">
          {course.lessons.map((l, idx) => (
            <LessonRow
              key={l.id}
              courseId={course.id}
              lesson={l}
              displayNumber={idx + 1}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function LessonRow({
  courseId,
  lesson,
  displayNumber,
}: {
  courseId: string;
  lesson: Lesson;
  displayNumber: number;
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateLessonAction,
    _initial,
  );
  const [delState, delFormAction, delPending] = useActionState(
    deleteLessonAction,
    _initial,
  );

  return (
    <li className="rounded-md border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            {String(displayNumber).padStart(2, "0")}.
          </span>{" "}
          {lesson.title}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-border bg-muted/20 px-2 py-1 text-[0.6875rem] font-semibold hover:bg-muted/40"
          >
            {editing ? "Close" : "Edit"}
          </button>
          <form action={delFormAction}>
            <input type="hidden" name="course_id" value={courseId} />
            <input type="hidden" name="lesson_id" value={lesson.id} />
            <button
              type="submit"
              disabled={delPending}
              className="rounded-md border border-status-red/40 bg-status-red/10 px-2 py-1 text-[0.6875rem] font-semibold text-status-red hover:bg-status-red/15 disabled:opacity-60"
            >
              {delPending ? "…" : "Delete"}
            </button>
          </form>
        </div>
      </div>
      {delState.status === "error" && delState.message ? (
        <ErrorBanner message={delState.message} />
      ) : null}
      {editing ? (
        <form action={formAction} className="space-y-2">
          {state.status === "error" && state.message ? (
            <ErrorBanner message={state.message} />
          ) : null}
          <input type="hidden" name="course_id" value={courseId} />
          <input type="hidden" name="lesson_id" value={lesson.id} />
          <input
            name="title"
            defaultValue={lesson.title}
            required
            maxLength={200}
            className="ff"
          />
          <textarea
            name="body_markdown"
            defaultValue={lesson.body_markdown}
            rows={6}
            maxLength={100_000}
            placeholder="Lesson body (markdown OK)"
            className="ff"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save lesson"}
            </button>
          </div>
        </form>
      ) : lesson.body_markdown ? (
        <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
          {lesson.body_markdown}
        </p>
      ) : (
        <p className="text-xs italic text-muted-foreground">
          No body yet.
        </p>
      )}
      <FormStyles />
    </li>
  );
}

function AddLessonForm({ courseId }: { courseId: string }) {
  const [state, formAction, pending] = useActionState(
    addLessonAction,
    _initial,
  );
  return (
    <section className="rounded-lg border border-status-blue/30 bg-status-blue/5 p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Add a lesson
      </h2>
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="course_id" value={courseId} />
        <input
          name="title"
          required
          maxLength={200}
          placeholder="Lesson title"
          className="ff"
        />
        <textarea
          name="body_markdown"
          rows={5}
          maxLength={100_000}
          placeholder="Lesson body (markdown OK)"
          className="ff"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add lesson"}
          </button>
        </div>
      </form>
      <FormStyles />
    </section>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-2 rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
    >
      {message}
    </div>
  );
}

function FormStyles() {
  return (
    <style>{`
      .ff {
        width: 100%;
        background: hsl(var(--background));
        color: hsl(var(--foreground));
        border: 1px solid hsl(var(--border));
        border-radius: 8px;
        padding: 0.5rem 0.75rem;
        font-size: 0.8125rem;
        outline: none;
      }
      .ff:focus:not(:disabled) {
        border-color: hsl(var(--primary));
        box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
      }
      textarea.ff { resize: vertical; font-family: inherit; }
    `}</style>
  );
}

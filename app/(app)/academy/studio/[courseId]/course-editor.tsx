"use client";

import { useActionState, useState } from "react";

import {
  COURSE_PUBLISH_STATUSES,
  COURSE_PUBLISH_STATUS_LABELS,
  type CourseDetail,
  type CoursePublishStatus,
  type Lesson,
} from "@/lib/api/academy";
import type { CurrencyItemRef } from "@/lib/api/types";

import {
  addLessonAction,
  type AdminActionState,
  deleteLessonAction,
  updateComplianceLinkAction,
  updatePublishStatusAction,
  updateLessonAction,
} from "./actions";

const _initial: AdminActionState = { status: "idle" };

export function CourseEditor({
  course,
  eligibleCurrencyItems,
}: {
  course: CourseDetail;
  eligibleCurrencyItems: CurrencyItemRef[];
}) {
  return (
    <div className="space-y-6">
      <PublishStatusPicker course={course} />
      {/* Key on the persisted link id so a successful save (which
          revalidates + re-passes course from the RSC) remounts the
          picker with fresh useState-initial values. Without the key
          the <select> holds its pre-save DOM value even after the
          badge above it flips to reflect the new state on disk. */}
      <ComplianceLinkPicker
        key={course.linked_currency_item_id ?? "unlinked"}
        course={course}
        eligibleItems={eligibleCurrencyItems}
      />
      <LessonList course={course} />
      <AddLessonForm courseId={course.id} />
    </div>
  );
}

function ComplianceLinkPicker({
  course,
  eligibleItems,
}: {
  course: CourseDetail;
  eligibleItems: CurrencyItemRef[];
}) {
  const [state, formAction, pending] = useActionState(
    updateComplianceLinkAction,
    _initial,
  );
  const persistedId = course.linked_currency_item_id ?? "";
  // Parent remounts this component via `key={persistedId}` when the
  // server-persisted link changes, so useState's initial value is
  // always the current backend state — no useEffect sync needed.
  const [selectedId, setSelectedId] = useState<string>(persistedId);

  // Show the currently-linked item even if it slipped out of the
  // eligible list (e.g. an admin flipped it to is_active=false
  // after the link was set). Without this the picker would silently
  // "forget" the current binding when the user opens the page.
  const displayed: CurrencyItemRef[] = (() => {
    const linkedId = course.linked_currency_item_id;
    if (!linkedId) return eligibleItems;
    if (eligibleItems.some((i) => i.id === linkedId)) return eligibleItems;
    // Synthesize a placeholder ref so the option still renders. The
    // real ref is unavailable from this component's server payload;
    // the label makes the drift visible so an operator investigates.
    const placeholder: CurrencyItemRef = {
      id: linkedId,
      code: "(unavailable)",
      name: "Linked item no longer eligible",
      regulation: "",
      interval_type: "annual",
      requires_examiner: false,
      is_check_event: false,
      is_initial_only: false,
      rolling_days: null,
      rolling_threshold: null,
      sort_order: 0,
      is_default: false,
      is_active: false,
    };
    return [placeholder, ...eligibleItems];
  })();

  const grouped = groupByRegulation(displayed);
  const linkedItem = displayed.find(
    (i) => i.id === course.linked_currency_item_id,
  );

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Compliance link
        </h2>
        {linkedItem ? (
          <span className="rounded border border-status-blue/40 bg-status-blue/10 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-blue">
            Fires {linkedItem.code || linkedItem.regulation || "linked item"}
          </span>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        When a pilot completes this course, we auto-file a currency
        completion against the linked regulation. Only calendar-month
        items are eligible — rolling-window and check-event items are
        excluded.
      </p>
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form
        action={formAction}
        className="flex flex-wrap items-center gap-3"
      >
        <input type="hidden" name="course_id" value={course.id} />
        <select
          name="linked_currency_item_id"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="min-w-[16rem] rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
          aria-label="Linked currency item"
        >
          <option value="">— No link —</option>
          {grouped.map(({ regulation, items }) => (
            <optgroup
              key={regulation || "unclassified"}
              label={regulation || "Other"}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code ? `${i.code} · ${i.name}` : i.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || selectedId === (course.linked_currency_item_id ?? "")}
          className="rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold hover:bg-muted/40 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </section>
  );
}

function groupByRegulation(items: CurrencyItemRef[]): Array<{
  regulation: string;
  items: CurrencyItemRef[];
}> {
  const map = new Map<string, CurrencyItemRef[]>();
  for (const i of items) {
    const key = i.regulation ?? "";
    const bucket = map.get(key);
    if (bucket) {
      bucket.push(i);
    } else {
      map.set(key, [i]);
    }
  }
  return [...map.entries()]
    .map(([regulation, items]) => ({
      regulation,
      items: [...items].sort((a, b) => a.sort_order - b.sort_order),
    }))
    .sort((a, b) => a.regulation.localeCompare(b.regulation));
}

function PublishStatusPicker({ course }: { course: CourseDetail }) {
  const [state, formAction, pending] = useActionState(
    updatePublishStatusAction,
    _initial,
  );
  const [status, setStatus] = useState<CoursePublishStatus>(
    course.publish_status,
  );
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Publish status
      </h2>
      {state.status === "error" && state.message ? (
        <ErrorBanner message={state.message} />
      ) : null}
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="course_id" value={course.id} />
        <select
          name="publish_status"
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as CoursePublishStatus)
          }
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        >
          {COURSE_PUBLISH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {COURSE_PUBLISH_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {status === "draft"
            ? "Hidden from learners while you edit."
            : status === "published"
              ? "Visible in the public catalog."
              : "Hidden from the catalog; existing enrollments still work."}
        </span>
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

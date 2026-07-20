import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  COURSE_CATEGORY_LABELS,
  ENROLLMENT_STATUS_LABELS,
  type CourseDetail,
  type Enrollment,
  type Lesson,
  getCourse,
  getEnrollment,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { LessonPlayer } from "./lesson-player";

/**
 * /academy/enrollments/[id] — Lesson player.
 *
 * Renders the current lesson (?lesson=<uuid> or the first incomplete
 * lesson by default) with a Mark Complete button + a lesson-list
 * sidebar. Completed lessons render with a check mark and can be
 * revisited but not un-marked.
 */
export default async function EnrollmentLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id } = await params;
  const { lesson: lessonParam } = await searchParams;

  let enrollment: Enrollment;
  try {
    enrollment = await getEnrollment(id);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  let course: CourseDetail;
  try {
    course = await getCourse(enrollment.course.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const completedLessonIds = new Set(
    enrollment.completions.map((c) => c.lesson_id),
  );
  const activeLesson: Lesson | null = _pickActiveLesson(
    course.lessons,
    completedLessonIds,
    lessonParam,
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link
            href={`/academy/${course.id}`}
            className="hover:text-foreground"
          >
            ← {course.title}
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {course.title}
          <span className="text-sm font-normal text-muted-foreground">
            {COURSE_CATEGORY_LABELS[course.category]}
          </span>
          <StatusChip status={enrollment.status} />
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {enrollment.completed_lessons} of {enrollment.total_lessons}{" "}
          lesson{enrollment.total_lessons === 1 ? "" : "s"} complete
          {enrollment.completed_at
            ? ` · Completed ${new Date(enrollment.completed_at).toLocaleDateString()}`
            : ""}
          {enrollment.expires_at
            ? ` · Expires ${new Date(enrollment.expires_at).toLocaleDateString()}`
            : ""}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
        <aside>
          <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Lessons
          </h2>
          <ol className="space-y-1">
            {course.lessons.map((l, idx) => {
              const done = completedLessonIds.has(l.id);
              const isActive = activeLesson?.id === l.id;
              return (
                <li key={l.id}>
                  <Link
                    href={`/academy/enrollments/${enrollment.id}?lesson=${l.id}`}
                    className={
                      "block rounded-md border px-2 py-1.5 text-xs " +
                      (isActive
                        ? "border-status-blue bg-status-blue/15 text-status-blue"
                        : "border-border bg-card text-foreground/80 hover:bg-muted/10")
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="line-clamp-1">
                        <span className="text-muted-foreground">
                          {String(idx + 1).padStart(2, "0")}.
                        </span>{" "}
                        {l.title}
                      </span>
                      {done ? (
                        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                          ✓
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="rounded-lg border border-border bg-card p-6">
          {activeLesson ? (
            <LessonPlayer
              enrollmentId={enrollment.id}
              lesson={activeLesson}
              isDone={completedLessonIds.has(activeLesson.id)}
              locked={enrollment.status !== "in_progress"}
            />
          ) : (
            <div className="text-sm text-muted-foreground">
              No lessons in this course yet.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function StatusChip({ status }: { status: Enrollment["status"] }) {
  const cls =
    status === "in_progress"
      ? "border-status-blue bg-status-blue/15 text-status-blue"
      : status === "completed"
        ? "border-status-green bg-status-green/15 text-status-green"
        : "border-status-yellow bg-status-yellow/15 text-status-yellow";
  return (
    <span
      className={
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {ENROLLMENT_STATUS_LABELS[status]}
    </span>
  );
}

function _pickActiveLesson(
  lessons: Lesson[],
  completed: Set<string>,
  urlLesson: string | undefined,
): Lesson | null {
  if (lessons.length === 0) return null;
  if (urlLesson) {
    const match = lessons.find((l) => l.id === urlLesson);
    if (match) return match;
  }
  // Default: first incomplete lesson, or the last lesson if all done.
  const nextIncomplete = lessons.find((l) => !completed.has(l.id));
  return nextIncomplete ?? lessons[lessons.length - 1];
}

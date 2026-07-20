import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  COURSE_CATEGORY_LABELS,
  type CourseDetail,
  type Enrollment,
  getCourse,
  listMyEnrollments,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { EnrolButton } from "./enrol-button";

/**
 * /academy/[courseId] — Course detail.
 *
 * Shows title / description / lesson outline + one of:
 *   - "Enrol in this course" button (if not already enrolled)
 *   - "Continue" link to /academy/enrollments/[id] (if in-progress)
 *   - "Completed" badge + re-enrol button (if expired)
 *   - "Completed" badge (if completed + not yet expired)
 */
export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;

  let course: CourseDetail;
  try {
    course = await getCourse(courseId);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  let myEnrollment: Enrollment | null = null;
  try {
    const mine = await listMyEnrollments({ limit: 200 });
    myEnrollment =
      mine.items.find((e) => e.course.id === courseId) ?? null;
  } catch {
    myEnrollment = null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/academy" className="hover:text-foreground">
            ← Academy
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {course.title}
          <span className="text-sm font-normal text-muted-foreground">
            {COURSE_CATEGORY_LABELS[course.category]}
          </span>
          {!course.is_active ? (
            <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Inactive
            </span>
          ) : null}
        </h1>
        {course.description ? (
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
            {course.description}
          </p>
        ) : null}
      </header>

      <EnrolCtaSection course={course} enrollment={myEnrollment} />

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Lessons
        </h2>
        {course.lessons.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No lessons yet.
          </p>
        ) : (
          <ol className="space-y-2">
            {course.lessons.map((l, idx) => {
              const done =
                myEnrollment?.completions.some(
                  (c) => c.lesson_id === l.id,
                ) ?? false;
              return (
                <li
                  key={l.id}
                  className="flex items-baseline justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {String(idx + 1).padStart(2, "0")}
                    </span>{" "}
                    <span className="font-semibold">{l.title}</span>
                  </div>
                  {done ? (
                    <span className="rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-status-green">
                      ✓ Done
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

function EnrolCtaSection({
  course,
  enrollment,
}: {
  course: CourseDetail;
  enrollment: Enrollment | null;
}) {
  if (enrollment && enrollment.status === "in_progress") {
    return (
      <section className="rounded-lg border border-status-blue/40 bg-status-blue/10 p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">In progress —</span>{" "}
          {enrollment.completed_lessons} of {enrollment.total_lessons}{" "}
          lesson{enrollment.total_lessons === 1 ? "" : "s"} complete.
        </div>
        <Link
          href={`/academy/enrollments/${enrollment.id}`}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Continue →
        </Link>
      </section>
    );
  }
  if (enrollment && enrollment.status === "completed") {
    return (
      <section className="rounded-lg border border-status-green/40 bg-status-green/10 p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">Completed</span>{" "}
          {enrollment.completed_at
            ? new Date(enrollment.completed_at).toLocaleDateString()
            : ""}
          {enrollment.expires_at
            ? ` — cert valid through ${new Date(enrollment.expires_at).toLocaleDateString()}`
            : " — cert never expires"}
        </div>
        <Link
          href={`/academy/enrollments/${enrollment.id}`}
          className="rounded-md border border-status-green bg-status-green/15 px-3 py-1.5 text-xs font-semibold text-status-green hover:bg-status-green/20"
        >
          View progress
        </Link>
      </section>
    );
  }
  if (enrollment && enrollment.status === "expired") {
    return (
      <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-4 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">Certificate expired</span> —
          time to re-enrol.
        </div>
        {course.is_active ? (
          <EnrolButton courseId={course.id} label="Re-enrol" />
        ) : null}
      </section>
    );
  }
  if (!course.is_active) {
    return (
      <section className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        This course is inactive — new enrollments are paused.
      </section>
    );
  }
  return (
    <section className="rounded-lg border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-2">
      <div className="text-sm text-muted-foreground">
        {course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"} ·{" "}
        {course.cert_valid_days > 0
          ? `Cert valid ${course.cert_valid_days} days`
          : "Cert never expires"}
      </div>
      <EnrolButton courseId={course.id} label="Enrol" />
    </section>
  );
}

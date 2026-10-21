import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
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
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/academy" className={cn(linkCaps, "text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Academy
        </Link>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 page-title">
          {course.title}
          <span className="text-sm font-normal text-muted-foreground">
            {COURSE_CATEGORY_LABELS[course.category]}
          </span>
          {!course.is_active ? (
            <span className="eyebrow">
              Inactive
            </span>
          ) : null}
          {course.linked_currency_item_id ? (
            <span
              className="eyebrow"
              title="Completing this course files a currency completion on your compliance record."
            >
              Compliance-linked
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
        <h2 className="mb-3 eyebrow">
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
                  className="flex items-baseline justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="eyebrow">
                      {String(idx + 1).padStart(2, "0")}
                    </span>{" "}
                    <span className="font-semibold">{l.title}</span>
                  </div>
                  {done ? (
                    <span className="status-mark text-status-green">
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
      <section className="notice notice-blue flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">In progress —</span>{" "}
          {enrollment.completed_lessons} of {enrollment.total_lessons}{" "}
          lesson{enrollment.total_lessons === 1 ? "" : "s"} complete.
        </div>
        <Link
          href={`/academy/enrollments/${enrollment.id}`}
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark"
        >
          Continue →
        </Link>
      </section>
    );
  }
  if (enrollment && enrollment.status === "completed") {
    return (
      <section className="notice notice-green flex flex-wrap items-center justify-between gap-2">
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
          className="btn-caps rounded-md border px-3 py-1.5 border-status-green/60 text-[0.72rem] text-status-green hover:border-status-green"
        >
          View progress
        </Link>
      </section>
    );
  }
  if (enrollment && enrollment.status === "expired") {
    return (
      <section className="notice notice-yellow flex flex-wrap items-center justify-between gap-2">
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

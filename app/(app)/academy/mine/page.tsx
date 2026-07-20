import Link from "next/link";

import {
  COURSE_CATEGORY_LABELS,
  ENROLLMENT_STATUS_LABELS,
  type Enrollment,
  listMyEnrollments,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

export default async function MyEnrollmentsPage() {
  let enrollments: Enrollment[] = [];
  let loadError: string | null = null;
  try {
    enrollments = (await listMyEnrollments({ limit: 200 })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Feed unavailable. Try refreshing in a moment.";
  }

  const [active, done, expired] = _partition(enrollments);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/academy" className="hover:text-foreground">
              ← Academy
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            My Enrollments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every course you&rsquo;ve started, completed, or need to
            re-take.
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            You haven&rsquo;t enrolled in any courses yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            <Link href="/academy" className="text-status-blue hover:underline">
              Browse the catalog
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 ? (
            <EnrollmentGroup label="In progress" items={active} />
          ) : null}
          {expired.length > 0 ? (
            <EnrollmentGroup label="Needs re-enrollment" items={expired} />
          ) : null}
          {done.length > 0 ? (
            <EnrollmentGroup label="Completed" items={done} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function EnrollmentGroup({
  label,
  items,
}: {
  label: string;
  items: Enrollment[];
}) {
  return (
    <section>
      <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </h2>
      <ul className="space-y-2">
        {items.map((e) => {
          const pct =
            e.total_lessons > 0
              ? Math.round((e.completed_lessons / e.total_lessons) * 100)
              : 0;
          return (
            <li key={e.id}>
              <Link
                href={`/academy/enrollments/${e.id}`}
                className="flex flex-wrap items-baseline justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-muted/5"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold">{e.course.title}</span>
                    <span className="text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                      {COURSE_CATEGORY_LABELS[e.course.category]}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">
                    {e.completed_lessons} / {e.total_lessons} lessons · {pct}%
                    {e.expires_at
                      ? ` · Expires ${new Date(e.expires_at).toLocaleDateString()}`
                      : e.completed_at
                        ? " · Cert never expires"
                        : ""}
                  </p>
                </div>
                <span
                  className={
                    "whitespace-nowrap rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                    (e.status === "in_progress"
                      ? "border-status-blue bg-status-blue/15 text-status-blue"
                      : e.status === "completed"
                        ? "border-status-green bg-status-green/15 text-status-green"
                        : "border-status-yellow bg-status-yellow/15 text-status-yellow")
                  }
                >
                  {ENROLLMENT_STATUS_LABELS[e.status]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function _partition(items: Enrollment[]): [Enrollment[], Enrollment[], Enrollment[]] {
  const active: Enrollment[] = [];
  const done: Enrollment[] = [];
  const expired: Enrollment[] = [];
  for (const e of items) {
    if (e.status === "in_progress") active.push(e);
    else if (e.status === "completed") done.push(e);
    else expired.push(e);
  }
  return [active, done, expired];
}

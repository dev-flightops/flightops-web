import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  COURSE_CATEGORY_LABELS,
  COURSE_PUBLISH_STATUS_LABELS,
  type Course,
  listCourses,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { AcademyHeader } from "../academy-header";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

/**
 * /academy/studio — Course Studio.
 *
 * Layout matches legacy peregrineflight.com/academy Studio tab:
 *   * Purple "Course Studio" heading + subtitle
 *   * Three right-aligned CTAs: Browse Templates (purple) · + Blank
 *     Course (dark) · Open Studio (yellow/gold)
 *   * Big graduation-cap empty state when there are no courses yet
 *   * When courses exist, render them below the CTA row (legacy
 *     shows the empty state at zero-count but the existing-drafts
 *     view isn't shown in the screenshot — best-guess: it's a table
 *     of drafts/published/archived once the operator has authored
 *     anything)
 *
 * Templates + Open-Studio (full-page WYSIWYG editor) are queued
 * follow-ups; the buttons render as disabled placeholders with
 * hover-titles so the visual matches legacy.
 */
export default async function StudioPage() {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (![...roles].some((r) => ADMIN_ROLES.has(r))) {
    redirect("/academy");
  }

  let courses: Course[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const response = await listCourses({
      include_all_statuses: true,
      limit: 200,
    });
    courses = response.items;
    total = response.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Course catalog unavailable.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="studio" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-status-purple">
            Course Studio
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Build training courses from scratch or start from a template
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            title="Course-template gallery ships with the Studio content pack (M4)"
            className="cursor-not-allowed rounded-md border border-status-purple/40 bg-status-purple/20 px-4 py-2 text-sm font-semibold text-status-purple/80"
          >
            Browse Templates
          </button>
          <Link
            href="/academy/studio/new"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground/90 hover:bg-muted/20"
          >
            + Blank Course
          </Link>
          <button
            type="button"
            disabled
            title="Full-page WYSIWYG Studio editor ships with the media-embed story (M4)"
            className="cursor-not-allowed rounded-md border border-status-yellow bg-status-yellow/20 px-4 py-2 text-sm font-semibold text-status-yellow/80"
          >
            Open Studio
          </button>
        </div>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : courses.length === 0 ? (
        <EmptyState />
      ) : (
        <CourseTable courses={courses} total={total} />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-16 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/20">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-10 w-10 text-muted-foreground/60"
          aria-hidden
        >
          <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z" />
        </svg>
      </div>
      <p className="text-base font-semibold">No courses created yet.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Click{" "}
        <Link
          href="/academy/studio/new"
          className="text-status-blue hover:underline"
        >
          + Blank Course
        </Link>{" "}
        to build your first training course.
      </p>
    </div>
  );
}

function CourseTable({
  courses,
  total,
}: {
  courses: Course[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Title
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Category
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Lessons
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Cert
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {courses.map((c) => (
              <tr key={c.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                  {c.title}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {COURSE_CATEGORY_LABELS[c.category]}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.lesson_count}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.cert_valid_days > 0
                    ? `${c.cert_valid_days} d`
                    : "Never"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={
                      "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                      (c.publish_status === "published"
                        ? "border-status-green/40 bg-status-green/10 text-status-green"
                        : c.publish_status === "draft"
                          ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
                          : "border-border bg-muted/30 text-muted-foreground")
                    }
                  >
                    {COURSE_PUBLISH_STATUS_LABELS[c.publish_status]}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/academy/studio/${c.id}`}
                    className="text-xs font-semibold text-status-blue hover:underline"
                  >
                    Edit →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border px-4 py-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} course{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

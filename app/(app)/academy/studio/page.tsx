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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="studio" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Author + publish courses. Toggle Draft / Published / Archived
          to control visibility without breaking in-flight enrollments.
        </p>
        <Link
          href="/academy/studio/new"
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          + New Course
        </Link>
      </div>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No courses yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            <Link
              href="/academy/studio/new"
              className="text-status-blue hover:underline"
            >
              Create the first course
            </Link>
            .
          </p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

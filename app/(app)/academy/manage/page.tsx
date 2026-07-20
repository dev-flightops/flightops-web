import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  COURSE_CATEGORY_LABELS,
  type Course,
  listCourses,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

export default async function ManageCoursesPage() {
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
      include_inactive: true,
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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/academy" className="hover:text-foreground">
              ← Academy
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Manage Courses
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create courses + edit lessons. Toggle Active to hide a
            course from the public catalog without breaking in-flight
            enrollments.
          </p>
        </div>
        <Link
          href="/academy/manage/new"
          className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
        >
          + New Course
        </Link>
      </header>

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
              href="/academy/manage/new"
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
                          (c.is_active
                            ? "border-status-green/40 bg-status-green/10 text-status-green"
                            : "border-border bg-muted/30 text-muted-foreground")
                        }
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/academy/manage/${c.id}`}
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

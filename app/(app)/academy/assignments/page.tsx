import Link from "next/link";

import { listUsers } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  COURSE_CATEGORY_LABELS,
  ENROLLMENT_STATUS_LABELS,
  listCourses,
  listEnrollments,
  type Course,
  type Enrollment,
  type EnrollmentStatus,
} from "@/lib/api/academy";
import type { UserResponse } from "@/lib/api/types";

import { AcademyHeader } from "../academy-header";
import { AssignCourseDrawer } from "./assign-course-drawer";
import { StatusFilter } from "./status-filter";

/**
 * /academy/assignments — Training assignment roster + bulk assign.
 *
 * Legacy peregrineflight /academy/assignments shape: a table of
 * every training assignment (employee × course × status), with a
 * `+ Assign Course` button top-right that opens a bulk assign flow.
 *
 * We build the same roster off the enrollment list (an "assignment"
 * in the legacy model = an enrolment for a specific learner). Bulk
 * assign is client-orchestrated: pick a course + a set of active
 * users → a server action fans out `enrol()` calls in series and
 * summarises assigned / skipped / failed.
 */
export const dynamic = "force-dynamic";

const VALID_STATUSES: readonly EnrollmentStatus[] = [
  "in_progress",
  "completed",
  "expired",
] as const;

function parseStatus(v: string | string[] | undefined): EnrollmentStatus | "" {
  const s = Array.isArray(v) ? v[0] : v;
  return VALID_STATUSES.includes(s as EnrollmentStatus)
    ? (s as EnrollmentStatus)
    : "";
}

export default async function AcademyAssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusFilter = parseStatus(params.status);

  let enrollments: Enrollment[] = [];
  let publishedCourses: Course[] = [];
  let users: UserResponse[] = [];
  let loadError: string | null = null;

  try {
    const [enrollmentsResp, coursesResp, usersResp] = await Promise.all([
      listEnrollments({
        status: statusFilter || undefined,
        limit: 500,
      }),
      // Bulk-assign drawer only offers published courses — drafts /
      // archived aren't valid enrol targets on the backend.
      listCourses({ publish_status: "published", limit: 200 }),
      listUsers(),
    ]);
    enrollments = enrollmentsResp.items;
    publishedCourses = coursesResp.items;
    users = usersResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have permission to view training assignments. Ask a Chief Pilot or Exec Admin."
          : "Assignments unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="assignments" />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold">Training Assignments</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {enrollments.length}{" "}
                {enrollments.length === 1 ? "enrolment" : "enrolments"}
                {statusFilter && (
                  <>
                    {" · Filtered to "}
                    <span className="font-medium">
                      {ENROLLMENT_STATUS_LABELS[statusFilter]}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusFilter current={statusFilter} />
              <AssignCourseDrawer
                courses={publishedCourses}
                users={users}
              />
            </div>
          </div>

          <AssignmentsTable enrollments={enrollments} />
        </>
      )}
    </div>
  );
}

function AssignmentsTable({ enrollments }: { enrollments: Enrollment[] }) {
  const sorted = [...enrollments].sort((a, b) =>
    (b.enrolled_at ?? "").localeCompare(a.enrolled_at ?? ""),
  );
  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        No assignments in this view. Try the + Assign Course button, or clear
        the status filter.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Learner</th>
              <th className="px-3 py-2.5 font-semibold">Course</th>
              <th className="px-3 py-2.5 font-semibold">Category</th>
              <th className="px-3 py-2.5 font-semibold">Enrolled</th>
              <th className="px-3 py-2.5 font-semibold">Progress</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Cert Expires</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((e) => (
              <tr key={e.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                  {e.user.full_name || e.user.email}
                </td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/academy/${e.course.id}`}
                    className="text-status-blue hover:underline"
                  >
                    {e.course.title}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-[0.7rem] text-muted-foreground">
                  {COURSE_CATEGORY_LABELS[e.course.category] ?? e.course.category}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  {fmtDate(e.enrolled_at)}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  {e.total_lessons > 0
                    ? `${e.completed_lessons} / ${e.total_lessons}`
                    : "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5">
                  <StatusBadge status={e.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                  {fmtDate(e.expires_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Enrollment["status"] }) {
  const map: Record<Enrollment["status"], string> = {
    in_progress:
      "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
    completed: "border-status-green/40 bg-status-green/10 text-status-green",
    expired: "border-status-red/40 bg-status-red/10 text-status-red",
  };
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        (map[status] ?? "border-border bg-muted/20 text-muted-foreground")
      }
    >
      {ENROLLMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

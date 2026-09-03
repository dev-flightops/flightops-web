import Link from "next/link";
import { hasAnyRole, roleGate } from "@/lib/roles";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  COURSE_CATEGORY_LABELS,
  type CourseDetail,
  getCourse,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";
import { listCurrencyItems } from "@/lib/api/ops";
import type { CurrencyItemRef } from "@/lib/api/types";

import { CourseEditor } from "./course-editor";

const ADMIN_ROLES = roleGate(
  "chief_pilot",
  "director_of_operations",
  "exec_admin",
);

export default async function ManageCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { courseId } = await params;
  const { created } = await searchParams;

  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  if (!hasAnyRole([...roles], ADMIN_ROLES)) {
    redirect("/academy");
  }

  let course: CourseDetail;
  let eligibleCurrencyItems: CurrencyItemRef[] = [];
  try {
    // Kick off both fetches in parallel — the currency-items list
    // isn't strictly required to render the page, so its failure
    // downgrades the compliance picker to a linked-only view
    // rather than blocking the whole editor.
    const [courseResp, itemsResp] = await Promise.all([
      getCourse(courseId),
      listCurrencyItems().catch(() => null),
    ]);
    course = courseResp;
    if (itemsResp) {
      eligibleCurrencyItems = itemsResp.items.filter(_isEligibleForLink);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) notFound();
      if (err.status === 401) redirect("/login");
    }
    throw err;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <Link href="/academy/studio" className="hover:text-foreground">
            ← Studio
          </Link>
        </p>
        <h1 className="mt-2 flex flex-wrap items-baseline gap-3 text-2xl font-bold tracking-tight">
          {course.title}
          <span className="text-sm font-normal text-muted-foreground">
            {COURSE_CATEGORY_LABELS[course.category]}
          </span>
        </h1>
      </header>

      {created === "1" ? (
        <div
          role="status"
          className="mb-4 rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Course created. Add lessons below.
        </div>
      ) : null}

      <CourseEditor
        course={course}
        eligibleCurrencyItems={eligibleCurrencyItems}
      />
    </div>
  );
}

// Mirrors the backend guard in services/academy/app/routes/courses.py::
// _validate_linked_currency — a course can only bind to an active,
// calendar-month, non-check-event item. The picker enforces this
// client-side so the option list matches what the backend will accept.
function _isEligibleForLink(item: CurrencyItemRef): boolean {
  if (!item.is_active) return false;
  if (item.is_check_event) return false;
  if (item.interval_type === "rolling_days") return false;
  return true;
}

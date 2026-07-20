import Link from "next/link";

import { auth } from "@/auth";
import {
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
  type Course,
  type CourseCategory,
  listCourses,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

/**
 * /academy — Public catalog.
 *
 * Any authenticated user can browse. Chief Pilot / Exec Admin see a
 * "Manage" affordance in the header + can view inactive courses via
 * ?include_inactive=1. Non-admin users always get the is_active=true
 * filter regardless of the URL param.
 */
export default async function AcademyCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; include_inactive?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const isAdmin = [...roles].some((r) => ADMIN_ROLES.has(r));

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const category = _validCategory(params.category);
  const includeInactive = isAdmin && params.include_inactive === "1";

  let courses: Course[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const response = await listCourses({
      q: q || undefined,
      category,
      include_inactive: includeInactive,
      limit: 200,
    });
    courses = response.items;
    total = response.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Course catalog unavailable. Try refreshing in a moment.";
  }

  const grouped = _groupByCategory(courses);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Academy</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Training courses — recurrent, new-hire, and elective. Enrol in
            anything relevant to your role.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/academy/mine"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            My Enrollments
          </Link>
          {isAdmin ? (
            <Link
              href="/academy/manage"
              className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
            >
              Manage
            </Link>
          ) : null}
        </div>
      </header>

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search course titles or descriptions…"
          className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
        <select
          name="category"
          defaultValue={category ?? ""}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        >
          <option value="">All categories</option>
          {COURSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {COURSE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        {isAdmin ? (
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="include_inactive"
              value="1"
              defaultChecked={includeInactive}
            />
            Show inactive
          </label>
        ) : null}
        <button
          type="submit"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
        >
          Filter
        </button>
      </form>

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
            {q || category
              ? "No courses match those filters."
              : "No courses yet."}
          </p>
          {isAdmin && !q && !category ? (
            <p className="mt-2 text-xs text-muted-foreground/70">
              <Link href="/academy/manage/new" className="text-status-blue hover:underline">
                Create the first course
              </Link>{" "}
              to get started.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <section key={category}>
              <h2 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                {COURSE_CATEGORY_LABELS[category]}
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {items.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-6 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} course{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <li>
      <Link
        href={`/academy/${course.id}`}
        className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-card p-4 hover:bg-muted/5"
      >
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="line-clamp-1 text-sm font-semibold">
            {course.title}
          </span>
          {!course.is_active ? (
            <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Inactive
            </span>
          ) : null}
        </div>
        {course.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {course.description}
          </p>
        ) : null}
        <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
          {course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"}
          {course.cert_valid_days > 0
            ? ` · Cert ${course.cert_valid_days}d`
            : " · Cert never expires"}
        </p>
      </Link>
    </li>
  );
}

function _validCategory(raw: string | undefined): CourseCategory | undefined {
  if (!raw) return undefined;
  return (COURSE_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CourseCategory)
    : undefined;
}

function _groupByCategory(
  items: Course[],
): Array<{ category: CourseCategory; items: Course[] }> {
  const groups = new Map<CourseCategory, Course[]>();
  for (const c of items) {
    if (!groups.has(c.category)) groups.set(c.category, []);
    groups.get(c.category)!.push(c);
  }
  const order: CourseCategory[] = [
    "recurrent",
    "safety",
    "regulatory",
    "new_hire",
    "elective",
  ];
  return order
    .filter((cat) => groups.has(cat))
    .map((cat) => ({ category: cat, items: groups.get(cat)! }));
}

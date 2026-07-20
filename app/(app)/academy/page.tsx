import Link from "next/link";

import { auth } from "@/auth";
import {
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
  COURSE_PUBLISH_STATUSES,
  COURSE_PUBLISH_STATUS_LABELS,
  type Course,
  type CourseCategory,
  type CoursePublishStatus,
  listCourses,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";

import { AcademyHeader } from "./academy-header";

const ADMIN_ROLES = new Set(["chief_pilot", "exec_admin"]);

/**
 * /academy — Peregrine Academy / Course Library.
 *
 * Layout matches legacy peregrineflight.com/academy/:
 *   * "Peregrine Academy" header with the graduation-cap glyph
 *   * Section sub-nav (Dashboard | Course Library | Assignments | Reports | Studio)
 *   * Search + status filter chips (All / Published / Draft / Archived) + Create Course
 *   * Two-column body: category sidebar (10 legacy buckets + total) on the left,
 *     course grid on the right
 *
 * Legacy shows courses regardless of publish_status for admins on this
 * page (Course Library = admin surface), so we default to
 * ?include_all_statuses=true when the caller is an admin. Learners
 * default to Published only and skip the status chips.
 */
export default async function CourseLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string }>;
}) {
  const session = await auth();
  const roles = new Set(session?.roles ?? []);
  const isAdmin = [...roles].some((r) => ADMIN_ROLES.has(r));

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const activeCategory = _validCategory(params.category);
  const publishStatus = _validStatus(params.status);

  // Admins see draft + archived + published on Course Library; learners
  // only see published (Studio is where drafts live for them anyway).
  let courses: Course[] = [];
  let loadError: string | null = null;
  try {
    const response = await listCourses({
      q: q || undefined,
      category: activeCategory,
      publish_status: publishStatus ?? undefined,
      include_all_statuses: isAdmin && !publishStatus,
      limit: 200,
    });
    courses = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Course catalog unavailable. Try refreshing in a moment.";
  }

  // Sidebar counts. Compute across the fetched set — small enough
  // (≤200 rows) that a separate aggregate query isn't worth it.
  const categoryCounts = new Map<CourseCategory, number>();
  for (const c of courses) {
    categoryCounts.set(c.category, (categoryCounts.get(c.category) ?? 0) + 1);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="course-library" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form
          method="GET"
          className="flex flex-wrap items-center gap-2"
        >
          {activeCategory ? (
            <input type="hidden" name="category" value={activeCategory} />
          ) : null}
          {publishStatus ? (
            <input type="hidden" name="status" value={publishStatus} />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search courses…"
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <nav
              aria-label="Filter by status"
              className="flex flex-wrap items-center gap-1"
            >
              <StatusChip
                href={_href({ q, category: activeCategory, status: null })}
                label="All"
                active={!publishStatus}
              />
              {/* Legacy chip order: All · Published · Draft · Archived. */}
              {(["published", "draft", "archived"] as const).map((s) => (
                <StatusChip
                  key={s}
                  href={_href({ q, category: activeCategory, status: s })}
                  label={COURSE_PUBLISH_STATUS_LABELS[s]}
                  active={publishStatus === s}
                />
              ))}
            </nav>
          ) : null}
          {isAdmin ? (
            <Link
              href="/academy/studio/new"
              className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              + Create Course
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_1fr]">
        <CategorySidebar
          courses={courses}
          activeCategory={activeCategory}
          currentQ={q}
          currentStatus={publishStatus}
          categoryCounts={categoryCounts}
        />

        <main>
          {loadError ? (
            <div
              role="alert"
              className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
            >
              {loadError}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState isAdmin={isAdmin} />
          ) : (
            <CourseGrid
              courses={
                activeCategory
                  ? courses.filter((c) => c.category === activeCategory)
                  : courses
              }
              isAdmin={isAdmin}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function _href(opts: {
  q: string;
  category: CourseCategory | undefined;
  status: CoursePublishStatus | null;
}): string {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.category) p.set("category", opts.category);
  if (opts.status) p.set("status", opts.status);
  const qs = p.toString();
  return qs ? `/academy?${qs}` : "/academy";
}

function StatusChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md border px-2.5 py-1 text-xs font-semibold transition " +
        (active
          ? "border-status-blue bg-status-blue/15 text-status-blue"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}

function CategorySidebar({
  courses,
  activeCategory,
  currentQ,
  currentStatus,
  categoryCounts,
}: {
  courses: Course[];
  activeCategory: CourseCategory | undefined;
  currentQ: string;
  currentStatus: CoursePublishStatus | null;
  categoryCounts: Map<CourseCategory, number>;
}) {
  return (
    <aside className="self-start rounded-lg border border-border bg-card p-3 text-xs">
      <SidebarItem
        href={_href({ q: currentQ, category: undefined, status: currentStatus })}
        label="All Courses"
        count={courses.length}
        active={!activeCategory}
        bold
      />
      {COURSE_CATEGORIES.map((cat) => (
        <SidebarItem
          key={cat}
          href={_href({ q: currentQ, category: cat, status: currentStatus })}
          label={COURSE_CATEGORY_LABELS[cat]}
          count={categoryCounts.get(cat) ?? 0}
          active={activeCategory === cat}
        />
      ))}
    </aside>
  );
}

function SidebarItem({
  href,
  label,
  count,
  active,
  bold,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
  bold?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 transition " +
        (active
          ? "bg-status-blue/15 text-status-blue"
          : "text-muted-foreground hover:bg-muted/20 hover:text-foreground") +
        (bold ? " font-semibold text-foreground" : "")
      }
    >
      <span>{label}</span>
      <span
        className={
          "tabular-nums text-[0.7rem] " +
          (active ? "" : "text-muted-foreground/60")
        }
      >
        {count}
      </span>
    </Link>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
      <p className="text-sm text-muted-foreground">No courses yet</p>
      {isAdmin ? (
        <div className="mt-4">
          <Link
            href="/academy/studio/new"
            className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            + Create Course
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function CourseGrid({
  courses,
  isAdmin,
}: {
  courses: Course[];
  isAdmin: boolean;
}) {
  if (courses.length === 0) {
    return <EmptyState isAdmin={isAdmin} />;
  }
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {courses.map((c) => (
        <li key={c.id}>
          <Link
            href={`/academy/${c.id}`}
            className="flex h-full min-w-0 flex-col rounded-lg border border-border bg-card p-4 hover:bg-muted/5"
          >
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="line-clamp-1 text-sm font-semibold">
                {c.title}
              </span>
              <PublishBadge status={c.publish_status} />
            </div>
            {c.description ? (
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {c.description}
              </p>
            ) : null}
            <p className="mt-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              {COURSE_CATEGORY_LABELS[c.category]} · {c.lesson_count} lesson
              {c.lesson_count === 1 ? "" : "s"}
              {c.cert_valid_days > 0
                ? ` · Cert ${c.cert_valid_days}d`
                : " · Cert never expires"}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PublishBadge({ status }: { status: CoursePublishStatus }) {
  if (status === "published") return null; // Common case — no badge.
  const cls =
    status === "draft"
      ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
      : "border-border bg-muted/30 text-muted-foreground";
  return (
    <span
      className={
        "rounded border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {COURSE_PUBLISH_STATUS_LABELS[status]}
    </span>
  );
}

function _validCategory(raw: string | undefined): CourseCategory | undefined {
  if (!raw) return undefined;
  return (COURSE_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CourseCategory)
    : undefined;
}

function _validStatus(raw: string | undefined): CoursePublishStatus | null {
  if (!raw) return null;
  return (COURSE_PUBLISH_STATUSES as readonly string[]).includes(raw)
    ? (raw as CoursePublishStatus)
    : null;
}

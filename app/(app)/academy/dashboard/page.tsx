import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  COURSE_CATEGORY_LABELS,
  ENROLLMENT_STATUS_LABELS,
  listCourses,
  listEnrollments,
  type Enrollment,
} from "@/lib/api/academy";

import { AcademyHeader } from "../academy-header";

/**
 * /academy/dashboard — Academy rollup.
 *
 * Aggregate view mirroring the legacy peregrineflight
 * /academy/ header stats (active courses, in-progress
 * assignments, completion rate) plus two recent-activity
 * lists Chief Pilots / DOs actually use:
 *
 *   1. 4 stat cards: Active Courses · In Progress · Completed · Expiring Soon
 *   2. Recent Completions + Certs Expiring Soon lists
 *
 * Read-only monitoring surface — edits happen on /academy/studio or
 * on individual enrollment pages. Same shape as /safety/dashboard so
 * the two rollups feel of a piece.
 */
export const dynamic = "force-dynamic";

/**
 * "Expiring soon" window in days. Matches the legacy peregrineflight
 * cert-expiry banner (30-day runway) so admins have time to re-assign
 * before the cert lapses.
 */
const EXPIRING_SOON_DAYS = 30;

export default async function AcademyDashboardPage() {
  let activeCourseCount = 0;
  let inProgressCount = 0;
  let completed: Enrollment[] = [];
  let loadError: string | null = null;

  try {
    // Course + in-progress calls only need the `total` for their stat
    // card, so keep `limit: 1` to avoid loading item payloads we don't
    // render. The completed call feeds the Recent Completions and
    // Expiring Soon lists, so it pulls a real page.
    const [coursesResp, inProgressResp, completedResp] = await Promise.all([
      listCourses({ publish_status: "published", limit: 1 }),
      listEnrollments({ status: "in_progress", limit: 1 }),
      listEnrollments({ status: "completed", limit: 200 }),
    ]);
    activeCourseCount = coursesResp.total;
    inProgressCount = inProgressResp.total;
    completed = completedResp.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Academy dashboard unavailable. Try refreshing in a moment.";
  }

  const expiringSoon = pickExpiringSoon(completed);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="dashboard" />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <StatCards
            activeCourseCount={activeCourseCount}
            inProgressCount={inProgressCount}
            completedCount={completed.length}
            expiringSoonCount={expiringSoon.length}
          />

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <RecentCompletionsCard completed={completed} />
            <ExpiringSoonCard enrollments={expiringSoon} />
          </div>
        </>
      )}
    </div>
  );
}

function StatCards({
  activeCourseCount,
  inProgressCount,
  completedCount,
  expiringSoonCount,
}: {
  activeCourseCount: number;
  inProgressCount: number;
  completedCount: number;
  expiringSoonCount: number;
}) {
  const total = inProgressCount + completedCount;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        value={activeCourseCount}
        label="Active Courses"
        hint="Published"
        tone="blue"
        href="/academy"
      />
      <StatCard
        value={inProgressCount}
        label="In Progress"
        hint={total > 0 ? `${completionRate}% completion rate` : "No enrollments yet"}
        tone={inProgressCount > 0 ? "yellow" : "green"}
        href="/academy/mine"
      />
      <StatCard
        value={completedCount}
        label="Completed"
        hint="All-time"
        tone="green"
        href="/academy/mine"
      />
      <StatCard
        value={expiringSoonCount}
        label="Expiring Soon"
        hint={
          expiringSoonCount > 0
            ? `Cert lapses in ${EXPIRING_SOON_DAYS}d`
            : "None on runway"
        }
        tone={expiringSoonCount > 0 ? "red" : "green"}
        href="/academy/mine"
      />
    </div>
  );
}

function StatCard({
  value,
  label,
  hint,
  tone,
  href,
}: {
  value: number;
  label: string;
  hint: string;
  tone: "green" | "yellow" | "red" | "blue";
  href: string;
}) {
  const toneClass = {
    green: "text-status-green",
    yellow: "text-status-yellow",
    red: "text-status-red",
    blue: "text-status-blue",
  }[tone];
  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-card px-3 py-3 transition-colors hover:bg-muted/5"
    >
      <div className={"text-2xl font-bold " + toneClass}>{value}</div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[0.7rem] text-muted-foreground/80">
        {hint}
      </div>
    </Link>
  );
}

function RecentCompletionsCard({ completed }: { completed: Enrollment[] }) {
  const sorted = [...completed]
    .sort((a, b) =>
      (b.completed_at ?? b.updated_at ?? "").localeCompare(
        a.completed_at ?? a.updated_at ?? "",
      ),
    )
    .slice(0, 5);
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Completions
        </h2>
        <Link
          href="/academy"
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          Course library →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {sorted.length === 0 ? (
          <EmptyState message="No completions yet." />
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/academy/${e.course.id}`}
                  className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/5"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-1 font-medium">
                      {e.course.title}
                    </div>
                    <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                      {e.user.full_name || e.user.email}
                      {" · "}
                      {COURSE_CATEGORY_LABELS[e.course.category] ?? e.course.category}
                      {" · "}
                      {fmtDate(e.completed_at ?? e.updated_at)}
                    </div>
                  </div>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function ExpiringSoonCard({ enrollments }: { enrollments: Enrollment[] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Certs Expiring Soon
        </h2>
        <Link
          href="/academy/mine"
          className="text-[0.7rem] font-semibold text-status-blue hover:underline"
        >
          My training →
        </Link>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {enrollments.length === 0 ? (
          <EmptyState
            message={`No certs expiring in the next ${EXPIRING_SOON_DAYS} days.`}
          />
        ) : (
          <ul className="divide-y divide-border">
            {enrollments.map((e) => {
              const days = daysUntil(e.expires_at);
              return (
                <li key={e.id}>
                  <Link
                    href={`/academy/${e.course.id}`}
                    className="flex items-baseline justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/5"
                  >
                    <div className="min-w-0">
                      <div className="line-clamp-1 font-medium">
                        {e.course.title}
                      </div>
                      <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                        {e.user.full_name || e.user.email}
                        {" · Expires "}
                        {fmtDate(e.expires_at)}
                      </div>
                    </div>
                    <ExpiryBadge days={days} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
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
        "flex-shrink-0 rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        (map[status] ?? "border-border bg-muted/20 text-muted-foreground")
      }
    >
      {ENROLLMENT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function ExpiryBadge({ days }: { days: number }) {
  const tone =
    days <= 7
      ? "border-status-red/40 bg-status-red/10 text-status-red"
      : days <= 14
        ? "border-status-yellow/60 bg-status-yellow/15 text-status-yellow"
        : "border-status-yellow/40 bg-status-yellow/10 text-status-yellow";
  const label = days <= 0 ? "Today" : `${days}d left`;
  return (
    <span
      className={
        "flex-shrink-0 rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
        tone
      }
    >
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
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

function daysUntil(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return Number.POSITIVE_INFINITY;
  const now = new Date();
  const diff = Math.floor((t.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  return diff;
}

function pickExpiringSoon(completed: Enrollment[]): Enrollment[] {
  return completed
    .filter((e) => {
      const d = daysUntil(e.expires_at);
      return d >= 0 && d <= EXPIRING_SOON_DAYS;
    })
    .sort((a, b) =>
      (a.expires_at ?? "").localeCompare(b.expires_at ?? ""),
    )
    .slice(0, 5);
}

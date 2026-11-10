import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { SegmentLinks } from "@/components/ff/segment-links";
import { StatusMark } from "@/components/ff/status-mark";
import { listStaff } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  listAssignments,
  listChecklists,
  type AssignmentSummary,
  type AssignmentView,
  type ChecklistSummary,
} from "@/lib/api/onboarding";
import { formatIsoDay } from "@/lib/iso-day";
import { ONBOARDING_ADMINS, hasAnyRole } from "@/lib/roles";

import { AssignForm } from "./assign-form";
import { ProgressBar } from "./progress-bar";

/**
 * /employees/onboarding (#180), legacy's /records/onboarding dashboard:
 * every new hire's onboarding under way, with progress and overdue tasks.
 *
 * Run by the Exec Admin, Director of Operations, Chief Pilot, Director of
 * Maintenance and Safety Officer (Greg, 10 Nov). Anyone else is sent to
 * their own tasks. Legacy showed only what's in progress; Complete and
 * Archived are here too, so a finished onboarding stays findable.
 */

export const dynamic = "force-dynamic";

const VIEWS: { view: AssignmentView; label: string }[] = [
  { view: "active", label: "In progress" },
  { view: "complete", label: "Complete" },
  { view: "archived", label: "Archived" },
];

const EMPTY: Record<AssignmentView, string> = {
  active: "No onboarding in progress. Assign a checklist to a new hire below.",
  complete: "No onboarding finished yet.",
  archived: "Nothing archived.",
};

function isView(value: string | undefined): value is AssignmentView {
  return VIEWS.some((v) => v.view === value);
}

function Row({ a }: { a: AssignmentSummary }) {
  const p = a.progress;
  return (
    <tr className={p.overdue > 0 ? "border-l-[3px] border-l-status-red" : undefined}>
      <td>
        <Link href={`/employees/onboarding/${a.id}`} className="font-semibold hover:underline">
          {a.employee.full_name}
        </Link>
        {a.employee.title ? <span className="block text-xs text-muted-foreground">{a.employee.title}</span> : null}
      </td>
      <td className="text-xs">{a.checklist_name}</td>
      <td className="whitespace-nowrap text-xs">{formatIsoDay(a.hire_date)}</td>
      <td className="min-w-[160px]">
        <ProgressBar pct={p.pct} overdue={p.overdue} />
        <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          <span>
            {p.done}/{p.total} done
          </span>
          {p.overdue > 0 ? <span className="font-semibold text-status-red">{p.overdue} overdue</span> : null}
        </span>
      </td>
      <td className="text-xs">
        {p.required_open > 0 ? (
          <StatusMark label={`${p.required_open} required`} tone="red" />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="text-xs">{a.supervisor?.full_name ?? "—"}</td>
      <td className="text-right">
        <Link href={`/employees/onboarding/${a.id}`} className={linkCaps}>
          Open<span className="sr-only"> {a.employee.full_name}</span> <span aria-hidden>›</span>
        </Link>
      </td>
    </tr>
  );
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).view;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const view: AssignmentView = isView(requested) ? requested : "active";
  const runsIt = hasAnyRole((await auth())?.roles ?? [], ONBOARDING_ADMINS);

  if (!runsIt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Onboarding" back={{ href: "/home", label: "Home" }} />
        <Notice tone="blue">
          Onboarding is run by the Exec Admin, Director of Operations, Chief Pilot, Director of Maintenance and Safety
          Officer. What falls to you is on{" "}
          <Link href="/employees/onboarding/my-tasks" className="font-semibold underline">
            My Tasks
          </Link>
          .
        </Notice>
      </div>
    );
  }

  let rows: AssignmentSummary[] | null = null;
  let loadError: string | null = null;
  try {
    rows = await listAssignments(view);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "Onboarding is unavailable. Try refreshing in a moment.";
  }
  const [checklists, staff] = await Promise.all([
    listChecklists().catch((): ChecklistSummary[] => []),
    listStaff()
      .then((s) => s.items)
      .catch(() => []),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Onboarding"
        back={{ href: "/employees", label: "HR" }}
        description="New hires' checklists, each task due a number of days after the hire date"
        actions={
          <>
            <Link href="/employees/onboarding/my-tasks" className={buttonOutline}>
              My Tasks
            </Link>
            <Link href="/employees/onboarding/checklists" className={buttonOutline}>
              Checklists
            </Link>
          </>
        }
      />
      <SegmentLinks
        label="Onboarding"
        className="mb-5"
        items={VIEWS.map((v) => ({
          href: v.view === "active" ? "/employees/onboarding" : `/employees/onboarding?view=${v.view}`,
          label: v.label,
          active: v.view === view,
        }))}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : rows && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>New Hire</th>
                <th>Checklist</th>
                <th>Hired</th>
                <th>Progress</th>
                <th>Before Starting</th>
                <th>Supervisor</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <Row key={a.id} a={a} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>{EMPTY[view]}</EmptyState>
      )}

      <Panel title="Assign a Checklist" className="mt-8">
        <AssignForm checklists={checklists} staff={staff} />
      </Panel>
    </div>
  );
}

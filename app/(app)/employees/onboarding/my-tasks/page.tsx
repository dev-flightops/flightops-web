import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { StatusMark } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { listMyOnboardingTasks, type MyOnboardingTask } from "@/lib/api/onboarding";
import { formatIsoDay } from "@/lib/iso-day";
import { taskTypeLabel } from "@/lib/onboarding/options";
import { ONBOARDING_ADMINS, hasAnyRole } from "@/lib/roles";

import { TaskActions } from "../task-actions";

/**
 * /employees/onboarding/my-tasks (#180), legacy's /records/onboarding/my-tasks:
 * the open onboarding tasks that fall to the person signed in, across every
 * new hire, soonest due first. Legacy sent each assignee a notification;
 * FlightOps has none of that kind, so this list and Home carry them.
 */

export const dynamic = "force-dynamic";

export default async function MyOnboardingTasksPage() {
  const runsIt = hasAnyRole((await auth())?.roles ?? [], ONBOARDING_ADMINS);
  let items: MyOnboardingTask[] | null = null;
  let loadError: string | null = null;
  try {
    items = (await listMyOnboardingTasks()).items;
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "Your onboarding tasks are unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My Onboarding Tasks"
        back={runsIt ? { href: "/employees/onboarding", label: "Onboarding" } : { href: "/home", label: "Home" }}
        description="What falls to you on new hires' onboarding, soonest due first"
        actions={
          runsIt ? (
            <Link href="/employees/onboarding" className={buttonOutline}>
              All Onboarding
            </Link>
          ) : null
        }
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : items && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Task</th>
                <th>New Hire</th>
                <th>Due</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id} className={t.overdue ? "border-l-[3px] border-l-status-red" : undefined}>
                  <td className="min-w-[220px]">
                    <span className="font-semibold">{t.name}</span>
                    {t.required_before_start ? <StatusMark label="Required" tone="red" className="ml-2" /> : null}
                    <span className="block text-xs text-muted-foreground">{taskTypeLabel(t.task_type)}</span>
                    {t.description ? <span className="block text-xs text-muted-foreground">{t.description}</span> : null}
                  </td>
                  <td className="text-xs">
                    <Link href={`/employees/onboarding/${t.assignment_id}`} className="font-semibold hover:underline">
                      {t.employee.full_name}
                    </Link>
                    <span className="block text-muted-foreground">{t.checklist_name}</span>
                  </td>
                  <td className={t.overdue ? "whitespace-nowrap text-xs font-semibold text-status-red" : "whitespace-nowrap text-xs"}>
                    {t.due_date ? formatIsoDay(t.due_date) : "—"}
                    {t.overdue ? <span className="block">Overdue</span> : null}
                  </td>
                  <td className="text-right">
                    <TaskActions assignmentId={t.assignment_id} task={t} />
                    <Link href={`/employees/onboarding/${t.assignment_id}`} className={`${linkCaps} mt-2 inline-block`}>
                      Open<span className="sr-only"> {t.employee.full_name}&apos;s onboarding</span> <span aria-hidden>›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>Nothing on anyone&apos;s onboarding falls to you.</EmptyState>
      )}
    </div>
  );
}

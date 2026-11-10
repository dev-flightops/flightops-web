import Link from "next/link";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { SegmentLinks } from "@/components/ff/segment-links";
import { StatusMark } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { listChecklists, type ChecklistSummary } from "@/lib/api/onboarding";
import { ONBOARDING_ADMINS, formatRole, hasAnyRole } from "@/lib/roles";

import { DuplicateButton, NewChecklistForm } from "./new-checklist-form";

/**
 * /employees/onboarding/checklists (#180), legacy's
 * templates/onboarding_checklist/checklists.html: the checklists a company
 * builds, each assigned to as many new hires as it fits. Every company builds
 * its own; there are no tasks built in.
 */

export const dynamic = "force-dynamic";

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const showArchived = (await searchParams).archived === "1";
  const runsIt = hasAnyRole((await auth())?.roles ?? [], ONBOARDING_ADMINS);

  if (!runsIt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Onboarding Checklists" back={{ href: "/home", label: "Home" }} />
        <Notice tone="blue">
          Checklists are built by the Exec Admin, Director of Operations, Chief Pilot, Director of Maintenance and Safety
          Officer.
        </Notice>
      </div>
    );
  }

  let checklists: ChecklistSummary[] | null = null;
  let loadError: string | null = null;
  try {
    checklists = await listChecklists(showArchived);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "The checklists are unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Onboarding Checklists"
        back={{ href: "/employees/onboarding", label: "Onboarding" }}
        description="Templates: each can be assigned to as many new hires as it fits"
      />
      <SegmentLinks
        label="Checklists"
        className="mb-5"
        items={[
          { href: "/employees/onboarding/checklists", label: "In use", active: !showArchived },
          { href: "/employees/onboarding/checklists?archived=1", label: "With archived", active: showArchived },
        ]}
      />
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : checklists && checklists.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Checklist</th>
                <th>For</th>
                <th className="text-right">Tasks</th>
                <th className="text-right">Under Way</th>
                <th>Status</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {checklists.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/employees/onboarding/checklists/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                    {c.description ? <span className="block text-xs text-muted-foreground">{c.description}</span> : null}
                  </td>
                  <td className="text-xs">{c.target_role ? formatRole(c.target_role) : "Any role"}</td>
                  <td className="text-right tabular-nums">{c.task_count}</td>
                  <td className="text-right tabular-nums">{c.in_progress_count}</td>
                  <td>
                    <StatusMark label={c.is_active ? "In use" : "Archived"} tone={c.is_active ? "green" : "gray"} />
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <DuplicateButton id={c.id} name={c.name} />
                    <Link href={`/employees/onboarding/checklists/${c.id}`} className={`${linkCaps} ml-3`}>
                      Edit<span className="sr-only"> {c.name}</span> <span aria-hidden>›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No checklists yet. Create one below, then add its tasks.</EmptyState>
      )}

      <Panel title="Create Checklist" className="mt-8">
        <NewChecklistForm />
      </Panel>
    </div>
  );
}

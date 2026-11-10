import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { StatusMark } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { listDocumentRequirements } from "@/lib/api/employee-documents";
import { getChecklist, type ChecklistDetail } from "@/lib/api/onboarding";
import { ONBOARDING_ADMINS, formatRole, hasAnyRole } from "@/lib/roles";

import { ChecklistEditor } from "./checklist-editor";

/**
 * /employees/onboarding/checklists/[id] (#180): one checklist's details and
 * its tasks, in order, with the form for another.
 */

export const dynamic = "force-dynamic";

export default async function ChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const runsIt = hasAnyRole((await auth())?.roles ?? [], ONBOARDING_ADMINS);
  if (!runsIt) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Onboarding Checklist" back={{ href: "/home", label: "Home" }} />
        <Notice tone="blue">
          Checklists are built by the Exec Admin, Director of Operations, Chief Pilot, Director of Maintenance and Safety
          Officer.
        </Notice>
      </div>
    );
  }

  let checklist: ChecklistDetail;
  try {
    checklist = await getChecklist(id);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 422)) notFound();
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Onboarding Checklist" back={{ href: "/employees/onboarding/checklists", label: "Checklists" }} />
        <Notice tone="yellow" role="alert">
          {err instanceof ApiError && err.status === 401
            ? "Your session expired — please sign in again."
            : "This checklist is unavailable. Try refreshing in a moment."}
        </Notice>
      </div>
    );
  }
  const requirements = await listDocumentRequirements()
    .then((r) => r.items.filter((x) => x.is_active))
    .catch(() => []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={checklist.name}
        back={{ href: "/employees/onboarding/checklists", label: "Checklists" }}
        description={
          <>
            {checklist.target_role ? `For ${formatRole(checklist.target_role)}` : "For any role"} · under way for{" "}
            {checklist.in_progress_count} new hire{checklist.in_progress_count === 1 ? "" : "s"}
          </>
        }
        actions={<StatusMark label={checklist.is_active ? "In use" : "Archived"} tone={checklist.is_active ? "green" : "gray"} />}
      />
      <ChecklistEditor key={`${checklist.id}-${checklist.name}-${checklist.is_active}`} checklist={checklist} requirements={requirements} />
    </div>
  );
}

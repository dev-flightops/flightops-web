
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { listUsers } from "@/lib/api/auth";
import type { UserResponse } from "@/lib/api/types";

import { NewPayEventForm } from "./new-pay-event-form";

/**
 * /payroll/new — Legacy `templates/payroll/new_event.html`.
 * Simple form to record one compensable event (flight pay, duty
 * pay, per diem, expense, etc.) against a user. Created rows land
 * in `pending` status; the /payroll list surfaces Approve/Reject
 * actions for exec admins.
 */

export const dynamic = "force-dynamic";

export default async function NewPayEventPage() {
  let users: UserResponse[] = [];
  let loadError: string | null = null;
  try {
    const response = await listUsers();
    users = response.items.filter((u) => u.is_active);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Employee list unavailable. Try again in a moment.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader
        back={{ href: "/payroll", label: "Pay Events" }}
        title="New Pay Event"
        description="Record a compensable event for an employee. New events land in pending status and need Approve before they can roll into a locked pay period."
      />

      {loadError ? (
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {loadError}
        </div>
      ) : (
        <NewPayEventForm employees={users} />
      )}
    </div>
  );
}

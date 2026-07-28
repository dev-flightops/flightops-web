import Link from "next/link";

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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link
          href="/payroll"
          className="text-muted-foreground hover:text-foreground"
        >
          Pay Events
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">
          /
        </span>
        <span className="font-semibold text-status-blue">New</span>
      </nav>

      <h1 className="mb-1 text-xl font-bold">New Pay Event</h1>
      <p className="mb-5 text-xs text-muted-foreground">
        Record a compensable event for an employee. New events land in
        pending status and need Approve before they can roll into a
        locked pay period.
      </p>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <NewPayEventForm employees={users} />
      )}
    </div>
  );
}

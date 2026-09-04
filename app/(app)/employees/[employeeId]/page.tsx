import { notFound } from "next/navigation";

import { getUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { EmployeeRecord } from "./employee-record";

/**
 * /employees/{id} — one employee's record.
 *
 * M3 shipped the directory and not this. Every name in that list linked
 * at /settings/users, which is the same page for everyone, so the link
 * looked like it went to a person's record and did not.
 *
 * Exec-admin gated server-side: the record carries a date of birth, a
 * home address and an emergency contact. A 403 renders as "you do not
 * have access" rather than as a missing employee, because those are
 * different things to tell someone.
 */

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;

  let employee;
  try {
    employee = await getUser(employeeId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {status === 401
            ? "Your session expired — please sign in again."
            : status === 403
              ? "You need Exec Admin to view an employee record."
              : "Employee record unavailable. Try refreshing in a moment."}
        </div>
      </div>
    );
  }

  return <EmployeeRecord employee={employee} />;
}

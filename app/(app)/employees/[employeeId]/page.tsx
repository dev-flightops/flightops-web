import { notFound } from "next/navigation";

import { getUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getAirmanRecord, listDisqualifications } from "@/lib/api/ops";

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

  // The 135.63 certificate record lives on the ops-service and was only
  // ever surfaced under /compliance/pilots/{id}, so an HR reader opening
  // an employee saw no certifications at all — even for a pilot whose
  // record existed two clicks away.
  //
  // Soft-failed and fetched in parallel, the same way the compliance
  // page does it: losing the record should cost this reader that
  // section, not the whole employee record. A non-pilot has no record
  // to fetch, and the 404 that returns is the expected answer rather
  // than an error.
  const [airman, disqualifications] = await Promise.all([
    getAirmanRecord(employeeId).catch(() => null),
    listDisqualifications(employeeId).catch(() => null),
  ]);

  return (
    <EmployeeRecord
      employee={employee}
      airman={airman}
      disqualifications={disqualifications}
    />
  );
}

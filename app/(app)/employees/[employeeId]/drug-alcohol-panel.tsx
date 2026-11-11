import Link from "next/link";

import { buttonOutline } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import type { EmployeeTests } from "@/lib/api/drug-alcohol";
import { REASON_TEXT, categoryLabel } from "@/lib/drug-alcohol/options";
import { localDateTime } from "@/lib/format/local-time";

import { TestsTable } from "../drug-alcohol/tests-table";

/**
 * The Drug & Alcohol tab of an employee record, legacy's employee D&A tab:
 * whether they're cleared for safety-sensitive duty and why not, and their
 * tests. Entering or correcting a test is on the program's own page.
 */
export function DrugAlcoholPanel({
  tests,
  loadError,
  zone,
}: {
  tests: EmployeeTests | null;
  loadError: string | null;
  zone: string;
}) {
  if (!tests) {
    return (
      <Notice tone="yellow" role="alert">
        {loadError ?? "Their tests are unavailable."}
      </Notice>
    );
  }
  const { person } = tests;
  const clearance = person.clearance;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {person.covered
            ? `Safety-sensitive${person.in_pool ? ", in the random pool" : ", left out of the random pool"} · FAA category: ${categoryLabel(person.category)}`
            : "Not safety-sensitive under the program: not in the random pool."}
        </p>
        <Link href={`/employees/drug-alcohol/employees/${person.user_id}`} className={buttonOutline}>
          Open in Drug &amp; Alcohol
        </Link>
      </div>
      {!tests.program_open ? (
        <Notice tone="blue" className="mb-5">
          The company hasn&rsquo;t set up its drug and alcohol program here yet: name its DER on the program&rsquo;s
          Program tab. Until then no one is flagged as not cleared.
        </Notice>
      ) : clearance && person.covered ? (
        clearance.cleared ? (
          <Notice tone="green" className="mb-5">
            Cleared for safety-sensitive duty.
          </Notice>
        ) : (
          <Notice tone="red" className="mb-5">
            Not cleared for safety-sensitive duty.
            {clearance.reasons.map((r) => (
              <span key={r} className="block">
                {REASON_TEXT[r]}
                {r === "alcohol_hold" && clearance.hold_ends_at
                  ? `: not before ${localDateTime(clearance.hold_ends_at, zone)}.`
                  : "."}
              </span>
            ))}
          </Notice>
        )
      ) : null}
      {tests.tests.length === 0 ? (
        <EmptyState>No tests on file.</EmptyState>
      ) : (
        <TestsTable tests={tests.tests} zone={zone} />
      )}
    </>
  );
}

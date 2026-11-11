import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { loadZoneTable } from "@/lib/api/auth";
import { getDrugAlcoholAccess, getMyTests, type DrugAlcoholAccess, type MyTests } from "@/lib/api/drug-alcohol";
import { REASON_TEXT } from "@/lib/drug-alcohol/options";
import { localDateTime } from "@/lib/format/local-time";

import { TestsTable } from "../tests-table";

/**
 * /employees/drug-alcohol/my-tests: anyone's own drug and alcohol tests and
 * whether they're cleared for safety-sensitive duty, with why not. Their
 * records are theirs to see (14 CFR 120.219(c)). Not a random selection
 * waiting on them: a random test is unannounced, and the DER tells them.
 */

export const dynamic = "force-dynamic";

export default async function MyTestsPage() {
  let mine: MyTests | null = null;
  let access: DrugAlcoholAccess | null = null;
  try {
    [mine, access] = await Promise.all([getMyTests(), getDrugAlcoholAccess()]);
  } catch {
    // Said below.
  }
  const zone = (await loadZoneTable()).fallback;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My Drug & Alcohol Tests"
        back={{ href: "/employees/drug-alcohol", label: "Drug & Alcohol" }}
        description={
          access?.der
            ? `Questions about a test go to the DER, ${access.der.full_name}${access.der_phone ? `, ${access.der_phone}` : ""}.`
            : undefined
        }
      />
      {!mine ? (
        <Notice tone="yellow" role="alert">
          Your tests are unavailable. Try refreshing in a moment.
        </Notice>
      ) : (
        <>
          {mine.clearance.cleared ? (
            <Notice tone="green" className="mb-5">
              You&rsquo;re cleared for safety-sensitive duty.
            </Notice>
          ) : mine.tests.length > 0 || mine.clearance.reasons.some((r) => r !== "no_pre_employment") ? (
            <Notice tone="red" className="mb-5">
              You&rsquo;re not cleared for safety-sensitive duty.
              {mine.clearance.reasons.map((r) => (
                <span key={r} className="block">
                  {REASON_TEXT[r]}
                  {r === "alcohol_hold" && mine?.clearance.hold_ends_at
                    ? `: not before ${localDateTime(mine.clearance.hold_ends_at, zone)}.`
                    : "."}
                </span>
              ))}
            </Notice>
          ) : null}
          {mine.tests.length === 0 ? (
            <EmptyState>No tests on file for you.</EmptyState>
          ) : (
            <TestsTable tests={mine.tests} zone={zone} />
          )}
        </>
      )}
    </div>
  );
}

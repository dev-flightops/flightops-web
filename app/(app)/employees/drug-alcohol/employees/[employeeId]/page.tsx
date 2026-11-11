import Link from "next/link";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  getEmployeeTests,
  listCollectors,
  type Collector,
  type EmployeeTests,
  type Panel as TestPanel,
} from "@/lib/api/drug-alcohol";
import { PANEL_LABEL, REASON_TEXT, categoryLabel } from "@/lib/drug-alcohol/options";
import { localDate, localDateTime } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";
import { formatRole } from "@/lib/roles";

import { TestsTable } from "../../tests-table";
import { TestForm } from "./test-form";
import { AttachForm, ReturnToDutyButton } from "./test-tools";

/**
 * One employee's drug and alcohol tests, legacy's /records/dat/employee/{id}:
 * whether they're cleared and why not, any random selection waiting on
 * them, their test history with its documents, and the forms to enter a
 * test, correct one, or attach a document. Whoever runs the program only.
 *
 * `?new=1` opens the form for a new test; `?entry=…&panel=…` opens it for a
 * random selection's test; `?edit=…` corrects a test; `?attach=…` attaches
 * a document to one.
 */

export const dynamic = "force-dynamic";

function one(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function EmployeeTestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employeeId } = await params;
  const query = await searchParams;
  const back = { href: "/employees/drug-alcohol", label: "Drug & Alcohol" };
  let data: EmployeeTests | null = null;
  let collectors: Collector[] = [];
  let loadError: string | null = null;
  try {
    [data, { items: collectors }] = await Promise.all([getEmployeeTests(employeeId), listCollectors()]);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 404
        ? "That employee isn't on file."
        : err instanceof ApiError && err.status === 403
          ? "Test records are for the program's DER, the alternate DER and the Exec Admins."
          : "Their tests are unavailable. Try refreshing in a moment.";
  }
  const zone = (await loadZoneTable()).fallback;

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Drug & Alcohol Tests" back={back} />
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      </div>
    );
  }

  const { person, tests, open_entries } = data;
  const entryId = one(query.entry);
  const entry = open_entries.find((e) => e.id === entryId);
  const editing = tests.find((t) => t.id === one(query.edit));
  const attaching = tests.find((t) => t.id === one(query.attach));
  const adding = Boolean(entry) || one(query.new) === "1";
  const clearance = person.clearance;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title={person.full_name}
        eyebrow="Drug & Alcohol Testing"
        back={back}
        description={[
          person.roles.map(formatRole).join(", "),
          `FAA category: ${categoryLabel(person.category)}`,
          person.hire_date ? `hired ${formatIsoDay(person.hire_date)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          adding || editing ? null : (
            <Link href={`/employees/drug-alcohol/employees/${person.user_id}?new=1`} className={buttonOutline}>
              Enter a Test
            </Link>
          )
        }
      />

      {clearance ? (
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
                  ? `: the DER returns them at their next duty period, not before ${localDateTime(clearance.hold_ends_at, zone)}.`
                  : "."}
              </span>
            ))}
          </Notice>
        )
      ) : null}

      {open_entries.length > 0 && !adding ? (
        <Panel title="Random Selections Waiting on Them" className="mb-6">
          <ul className="divide-y divide-border">
            {open_entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {PANEL_LABEL[e.panel]} · drawn {localDate(e.selected_at, zone, { withYear: true })}
                  {e.period_label ? ` · ${e.period_label}` : ""}
                  {e.notified_at ? ` · told ${localDateTime(e.notified_at, zone)}` : " · not yet told"}
                </span>
                <span className="flex gap-4">
                  <Link href={`/employees/drug-alcohol/selections/${e.selection_id}`} className={linkCaps}>
                    Selection <span aria-hidden>›</span>
                  </Link>
                  <Link
                    href={`/employees/drug-alcohol/employees/${person.user_id}?entry=${e.id}&panel=${e.panel}`}
                    className={linkCaps}
                  >
                    Enter test <span aria-hidden>›</span>
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {adding ? (
        <Panel title={entry ? `Enter the ${PANEL_LABEL[entry.panel].toLowerCase()} test for the random selection` : "Enter a Test"} className="mb-6">
          <TestForm
            userId={person.user_id}
            zone={zone}
            collectors={collectors}
            category={person.category}
            selectionEntryId={entry?.id ?? null}
            panel={(entry?.panel ?? (one(query.panel) === "alcohol" ? "alcohol" : "drug")) as TestPanel}
          />
        </Panel>
      ) : null}
      {editing ? (
        <Panel title={`Correct the Test of ${formatIsoDay(editing.test_date)}`} className="mb-6">
          <TestForm userId={person.user_id} zone={zone} collectors={collectors} category={editing.category} test={editing} />
        </Panel>
      ) : null}
      {attaching ? (
        <Panel title={`Attach a Document to the Test of ${formatIsoDay(attaching.test_date)}`} className="mb-6">
          <AttachForm userId={person.user_id} testId={attaching.id} />
        </Panel>
      ) : null}

      <h2 className="section-title mb-3">Test History ({tests.length})</h2>
      {tests.length === 0 ? (
        <EmptyState>No tests on file.</EmptyState>
      ) : (
        <TestsTable
          tests={tests}
          zone={zone}
          actions={(t) => (
            <span className="flex flex-col items-end gap-1">
              <Link href={`/employees/drug-alcohol/employees/${person.user_id}?edit=${t.id}`} className={linkCaps}>
                {t.result === null ? "Enter result" : "Correct"}
                <span className="sr-only"> the test of {formatIsoDay(t.test_date)}</span>
              </Link>
              <Link href={`/employees/drug-alcohol/employees/${person.user_id}?attach=${t.id}`} className={linkCaps}>
                Attach<span className="sr-only"> a document to the test of {formatIsoDay(t.test_date)}</span>
              </Link>
              {t.result === "alcohol_02" && !t.returned_to_duty_at ? (
                <ReturnToDutyButton userId={person.user_id} testId={t.id} />
              ) : null}
            </span>
          )}
        />
      )}
    </div>
  );
}

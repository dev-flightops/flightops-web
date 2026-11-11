import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { Stat, StatStrip } from "@/components/ff/stat-strip";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  getClearance,
  getDrugAlcoholAccess,
  getOverview,
  type ClearanceList,
  type DrugAlcoholAccess,
  type Overview,
  type RandomRate,
} from "@/lib/api/drug-alcohol";
import { getComplianceSettings } from "@/lib/api/type-qualifications";
import { ENTRY_STATUS_LABEL, PANEL_LABEL, REASON_TEXT } from "@/lib/drug-alcohol/options";
import { localDate, localDateTime } from "@/lib/format/local-time";
import { formatIsoDay } from "@/lib/iso-day";
import { RELEASE_POLICY_ADMINS, formatRole, hasAnyRole } from "@/lib/roles";

import { DatNav } from "./dat-nav";
import { ReleaseCard } from "./release-card";
import { TestsTable } from "./tests-table";

/**
 * /employees/drug-alcohol, legacy's /records/dat dashboard: the DOT drug and
 * alcohol testing program (14 CFR 120, 49 CFR 40).
 *
 * Three views, by who's looking (Greg, 11 Nov):
 * - the DER, the alternate DER and the Exec Admins run the program and see
 *   everything: the year's random rates, who isn't cleared and why, who's
 *   waiting on a test or a result;
 * - the leaders see who's cleared for safety-sensitive duty, yes or no, and
 *   who the DER is;
 * - everyone else is pointed at their own tests.
 */

export const dynamic = "force-dynamic";

function unavailable(err: unknown): string {
  return err instanceof ApiError && err.status === 401
    ? "Your session expired — please sign in again."
    : "The drug and alcohol program is unavailable. Try refreshing in a moment.";
}

function derLine(access: Pick<DrugAlcoholAccess, "der" | "der_phone">): string {
  if (!access.der) return "No DER named yet.";
  return `DER: ${access.der.full_name}${access.der_phone ? ` · ${access.der_phone}` : ""}`;
}

export default async function DrugAlcoholPage() {
  let access: DrugAlcoholAccess;
  try {
    access = await getDrugAlcoholAccess();
  } catch (err) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader title="Drug & Alcohol Testing" back={{ href: "/employees", label: "HR" }} />
        <Notice tone="yellow" role="alert">
          {unavailable(err)}
        </Notice>
      </div>
    );
  }
  // Called, not rendered as elements: each view fetches what it needs.
  if (access.runs_program) return await Dashboard({ access });
  if (access.sees_clearance) return await LeaderView({ access });
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader title="Drug & Alcohol Testing" back={{ href: "/home", label: "Home" }} />
      <Notice tone="blue">
        Test results are kept by the company&rsquo;s Designated Employer Representative. {derLine(access)} Your own
        tests are on{" "}
        <Link href="/employees/drug-alcohol/my-tests" className="font-semibold underline">
          My Tests
        </Link>
        .
      </Notice>
    </div>
  );
}

function RateStat({ rate }: { rate: RandomRate }) {
  return (
    <Stat
      value={`${rate.done}/${rate.required}`}
      label={`Random ${rate.panel} · ${rate.rate_pct}%`}
      tone={rate.met ? "green" : "yellow"}
      hint={rate.basis === "today" ? "against today's pool: no draw yet" : `average pool ${rate.average_pool}`}
    />
  );
}

async function Dashboard({ access }: { access: DrugAlcoholAccess }) {
  let overview: Overview | null = null;
  let loadError: string | null = null;
  try {
    overview = await getOverview();
  } catch (err) {
    loadError = unavailable(err);
  }
  const zone = (await loadZoneTable()).fallback;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Drug & Alcohol Testing"
        back={{ href: "/employees", label: "HR" }}
        description={`DOT program under 14 CFR 120 and 49 CFR 40. ${derLine(access)}`}
        actions={
          <Link href="/employees/drug-alcohol/my-tests" className={buttonOutline}>
            My Tests
          </Link>
        }
      />
      <DatNav active="home" />
      {loadError || !overview ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The drug and alcohol program is unavailable."}
        </Notice>
      ) : (
        <>
          {!overview.program.der ? (
            <Notice tone="yellow" className="mb-5">
              Name the program&rsquo;s Designated Employer Representative on the{" "}
              <Link href="/employees/drug-alcohol/program" className="font-semibold underline">
                Program
              </Link>{" "}
              tab. Until then only the Exec Admins can see it.
            </Notice>
          ) : null}
          <StatStrip label={`The program in ${overview.year}`}>
            <Stat value={overview.pool_size} label="In the random pool" tone="brand" />
            {overview.random.map((r) => (
              <RateStat key={r.panel} rate={r} />
            ))}
            <Stat
              value={overview.tests_this_year.drug + overview.tests_this_year.alcohol}
              label={`Tests in ${overview.year}`}
              hint={`${overview.tests_this_year.drug} drug · ${overview.tests_this_year.alcohol} alcohol`}
            />
            <Stat
              value={overview.tests_this_year.violations}
              label="Violations"
              tone={overview.tests_this_year.violations > 0 ? "red" : "neutral"}
            />
          </StatStrip>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title={`Not Cleared (${overview.not_cleared.length})`}>
              {overview.not_cleared.length === 0 ? (
                <p className="text-sm text-muted-foreground">Everyone safety-sensitive is cleared.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.not_cleared.map((p) => (
                    <li key={p.user_id} className="flex flex-wrap items-start justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="font-semibold">{p.full_name}</span>
                        {p.reasons.map((r) => (
                          <span key={r} className="block text-xs text-muted-foreground">
                            {REASON_TEXT[r]}
                            {r === "alcohol_hold" && p.hold_ends_at
                              ? `; not before ${localDateTime(p.hold_ends_at, zone)}`
                              : ""}
                          </span>
                        ))}
                      </span>
                      <Link href={`/employees/drug-alcohol/employees/${p.user_id}`} className={linkCaps}>
                        Tests<span className="sr-only"> for {p.full_name}</span> <span aria-hidden>›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Waiting on a Test (${overview.open_entries.length})`}>
              {overview.open_entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one drawn is waiting to be tested.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.open_entries.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <span className="font-semibold">{e.full_name}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {PANEL_LABEL[e.panel]} · drawn {localDate(e.selected_at, zone)}
                          {e.period_label ? ` · ${e.period_label}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <StatusMark label={ENTRY_STATUS_LABEL[e.status]} tone={e.status === "notified" ? "blue" : "yellow"} />
                        <Link href={`/employees/drug-alcohol/selections/${e.selection_id}`} className={linkCaps}>
                          Open<span className="sr-only"> the selection for {e.full_name}</span> <span aria-hidden>›</span>
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Waiting on a Result (${overview.pending_results.length})`}>
              {overview.pending_results.length === 0 ? (
                <p className="text-sm text-muted-foreground">No test is waiting on its result.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.pending_results.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <span className="font-semibold">{t.full_name}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {t.test_type_label} {t.panel} · {formatIsoDay(t.test_date)}
                        </span>
                      </span>
                      <Link href={`/employees/drug-alcohol/employees/${t.user_id}`} className={linkCaps}>
                        Enter result<span className="sr-only"> for {t.full_name}</span> <span aria-hidden>›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Recent Random Selections"
              actions={
                <Link href="/employees/drug-alcohol/pool" className={linkCaps}>
                  Random pool <span aria-hidden>›</span>
                </Link>
              }
            >
              {overview.recent_selections.length === 0 ? (
                <p className="text-sm text-muted-foreground">No random selections yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {overview.recent_selections.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        <span className="font-semibold">{localDate(s.selected_at, zone, { withYear: true })}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {PANEL_LABEL[s.panel]} · {s.selected_count} of {s.pool_size}
                          {s.period_label ? ` · ${s.period_label}` : ""}
                          {s.method === "entered" ? ` · from ${s.source}` : ""}
                        </span>
                      </span>
                      <Link href={`/employees/drug-alcohol/selections/${s.id}`} className={linkCaps}>
                        Open<span className="sr-only"> the selection of {localDate(s.selected_at, zone)}</span>{" "}
                        <span aria-hidden>›</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <h2 className="section-title mb-3 mt-8">Recent Tests</h2>
          {overview.recent_tests.length === 0 ? (
            <EmptyState>No tests yet. Open someone from the random pool to enter one.</EmptyState>
          ) : (
            <TestsTable tests={overview.recent_tests} zone={zone} showName />
          )}
        </>
      )}
    </div>
  );
}

async function LeaderView({ access }: { access: DrugAlcoholAccess }) {
  const session = await auth();
  let list: ClearanceList | null = null;
  let loadError: string | null = null;
  try {
    list = await getClearance();
  } catch (err) {
    loadError = unavailable(err);
  }
  const settings = await getComplianceSettings().catch(() => null);
  const notCleared = list?.items.filter((i) => !i.cleared).length ?? 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Drug & Alcohol Testing"
        back={{ href: "/employees", label: "HR" }}
        description={derLine(access)}
        actions={
          <Link href="/employees/drug-alcohol/my-tests" className={buttonOutline}>
            My Tests
          </Link>
        }
      />
      <Notice tone="blue" className="mb-5">
        Test results are confidential (49 CFR 40.321): the DER and the Exec Admins see them. Here is who&rsquo;s cleared
        for safety-sensitive duty; ask the DER about anyone who isn&rsquo;t.
      </Notice>
      {settings ? (
        <ReleaseCard settings={settings} canChange={hasAnyRole(session?.roles ?? [], RELEASE_POLICY_ADMINS)} />
      ) : null}
      {loadError || !list ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The drug and alcohol program is unavailable."}
        </Notice>
      ) : list.items.length === 0 ? (
        <EmptyState>No one safety-sensitive on the staff yet.</EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {notCleared === 0 ? "Everyone is cleared." : `${notCleared} of ${list.items.length} not cleared.`}
          </p>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="ff-table w-full text-sm">
              <thead className="ff-thead">
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Cleared</th>
                </tr>
              </thead>
              <tbody>
                {list.items.map((i) => (
                  <tr key={i.user_id} className={i.cleared ? undefined : "border-l-[3px] border-l-status-red"}>
                    <td className="font-semibold">{i.full_name}</td>
                    <td className="text-xs">{i.roles.map(formatRole).join(", ")}</td>
                    <td>
                      <StatusMark label={i.cleared ? "Cleared" : "Not cleared"} tone={i.cleared ? "green" : "red"} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

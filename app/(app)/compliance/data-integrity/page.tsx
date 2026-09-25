import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import {
  getIntegrityAudit,
  type CycleStatus,
  type FindingScope,
  type IntegrityAudit,
  type IntegrityFinding,
} from "@/lib/api/reports";

import { attestAction } from "./actions";
import { AttestForm } from "./attest-form";

/**
 * /compliance/data-integrity — the 30-day review the GOM requires.
 *
 * The operator's manual calls for a data integrity audit on a 30-day
 * cycle with a 60-day maximum review interval, under the Director of
 * Operations, retaining the reviewer's identity and a timestamp.
 * Nothing in this platform recorded one, and neither does the legacy
 * system — we had three audit tables and all three record *changes*
 * rather than reviews.
 *
 * WHAT MAKES THIS A REVIEW RATHER THAN A BUTTON
 *
 * The manual does not say what to look at, which is the part that
 * decides whether this page is useful or theatre. Each finding is a
 * defect this platform's own data turned out to carry — the 246-hour
 * block time that inflated a month from 63 hours to 307, the flights
 * that departed with nobody counted, the bookings attached to no
 * flight that made every schedule export report zero passengers sold.
 *
 * So every finding renders its own explanation, not just a count. The
 * person signing is accountable for having understood it, and a number
 * with no sentence beside it cannot be understood.
 *
 * SIGNING RECORDS THE REVIEW AND CLEARS NOTHING
 *
 * Said twice on the page, because it is the one thing somebody might
 * reasonably assume it does. The obligation is periodic review, not an
 * absence of findings: refusing a signature while any exist would
 * leave an operator with a backlog unable to comply at all. The record
 * carries what was open, so a reader a year later sees "attested with
 * 14 contradictions outstanding".
 */

export const dynamic = "force-dynamic";

/** Matches reports-service's AuditSigner. The GOM makes the DO
 *  responsible; exec admin is admitted so an operator whose DO account
 *  is unavailable can still meet a 60-day obligation. */
const SIGNING_ROLES = new Set(["director_of_operations", "exec_admin"]);

const SCOPE_LABEL: Record<FindingScope, string> = {
  window: "in this window",
  all_time: "all history",
  fleet: "current fleet",
};

const SCOPE_WHY: Record<FindingScope, string> = {
  window: "Counted over the 30 days under review.",
  all_time:
    "Counted over all history, not just the window. A record that disagrees with another does not stop being wrong as it ages, and a review that only looked at 30 days would never look at anything twice.",
  fleet:
    "Counted against the fleet as it stands now. An aircraft with no operating cost is not misconfigured 'during the last thirty days' — it is misconfigured.",
};

const STATUS_TONE: Record<CycleStatus, string> = {
  current: "text-status-green",
  due: "text-status-yellow",
  overdue: "text-status-red",
};

const STATUS_BORDER: Record<CycleStatus, string> = {
  current: "border-status-green/40 bg-status-green/5",
  due: "border-status-yellow/40 bg-status-yellow/5",
  overdue: "border-status-red/40 bg-status-red/5",
};

const STATUS_LABEL: Record<CycleStatus, string> = {
  current: "Current",
  due: "Review due",
  overdue: "Out of compliance",
};

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—";
}

function ROLE(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function CycleBanner({ audit }: { audit: IntegrityAudit }) {
  const status = audit.cycle_status;
  return (
    <div className={`rounded-xl border p-4 ${STATUS_BORDER[status]}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className={`text-sm font-bold ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </h2>
        <p className="text-xs text-muted-foreground">
          {audit.last_attested_at ? (
            <>
              Last reviewed {day(audit.last_attested_at)} —{" "}
              {audit.days_since_last} day
              {audit.days_since_last === 1 ? "" : "s"} ago. Next due{" "}
              {day(audit.next_due_at)}, and the {audit.max_interval_days}-day
              limit falls {day(audit.compliance_deadline)}.
            </>
          ) : (
            <>No review has ever been recorded on this operator.</>
          )}
        </p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{audit.advisory}</p>
    </div>
  );
}

function Tally({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-0.5 text-lg font-semibold tabular-nums ${
          value > 0 && tone ? tone : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{sub}</p>
    </div>
  );
}

function FindingRow({ finding }: { finding: IntegrityFinding }) {
  const clear = finding.count === 0;
  const tone =
    finding.kind === "contradiction" ? "text-status-red" : "text-status-yellow";
  return (
    <li
      data-testid={`finding-${finding.key}`}
      className="border-t border-border px-3 py-3 first:border-t-0"
    >
      <div className="flex items-start gap-3">
        <span
          className={`min-w-[2.5rem] text-right text-sm font-semibold tabular-nums ${
            clear ? "text-muted-foreground" : tone
          }`}
        >
          {finding.count}
        </span>
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold ${
              clear ? "text-muted-foreground" : "text-foreground"
            }`}
          >
            {finding.label}
            <span
              title={SCOPE_WHY[finding.scope]}
              className="ml-2 rounded border border-border px-1.5 py-0.5 text-[0.55rem] font-normal uppercase tracking-wider text-muted-foreground"
            >
              {SCOPE_LABEL[finding.scope]}
            </span>
          </p>
          {/* Rendered whether or not the count is zero: somebody
              signing this is accountable for having understood what
              was checked, including the checks that came back clean. */}
          <p className="mt-1 text-[0.7rem] leading-relaxed text-muted-foreground">
            {finding.detail}
          </p>
          {finding.examples.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {finding.examples.map((example) => (
                <li
                  key={example}
                  className="font-mono text-[0.68rem] text-muted-foreground"
                >
                  {example}
                </li>
              ))}
              {finding.count > finding.examples.length && (
                <li className="text-[0.68rem] text-muted-foreground">
                  and {finding.count - finding.examples.length} more
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function Group({
  title,
  blurb,
  findings,
}: {
  title: string;
  blurb: string;
  findings: IntegrityFinding[];
}) {
  if (findings.length === 0) return null;
  return (
    <section aria-label={title} className="mb-4">
      <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h2>
      <p className="mb-2 mt-0.5 text-[0.7rem] text-muted-foreground">
        {blurb}
      </p>
      <ul className="rounded-xl border border-border bg-card">
        {findings.map((f) => (
          <FindingRow key={f.key} finding={f} />
        ))}
      </ul>
    </section>
  );
}

export default async function DataIntegrityPage() {
  const session = await auth();
  const canSign = (session?.roles ?? []).some((r: string) =>
    SIGNING_ROLES.has(r),
  );

  let audit: IntegrityAudit | null = null;
  let loadError: string | null = null;
  try {
    audit = await getIntegrityAudit();
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `reports-service refused the request (HTTP ${err.status}).`
        : "Could not reach reports-service.";
  }

  if (!audit) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Data Integrity Review</h1>
        <div className="mt-4 rounded-xl border border-status-red/40 bg-status-red/5 p-4">
          <p className="text-sm font-semibold text-status-red">
            The audit could not be built
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  const contradictions = audit.findings.filter(
    (f) => f.kind === "contradiction",
  );
  const omissions = audit.findings.filter((f) => f.kind === "omission");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Data Integrity Review</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The {audit.cycle_days}-day audit required by the General
          Operations Manual · window {day(audit.window_start)} to{" "}
          {day(audit.window_end)}
        </p>
      </header>

      <div className="mb-4">
        <CycleBanner audit={audit} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-2">
        <Tally
          label="Contradictions"
          value={audit.contradictions}
          sub="records disagree — at least one is wrong"
          tone="text-status-red"
        />
        <Tally
          label="Omissions"
          value={audit.omissions}
          sub="something required is absent"
          tone="text-status-yellow"
        />
      </div>

      <Group
        title="Contradictions"
        blurb="The records disagree with each other or with physical reality, so at least one of them is wrong and somebody has to decide which. Correct these."
        findings={contradictions}
      />
      <Group
        title="Omissions"
        blurb="Nothing recorded is wrong; there is not enough of it. Complete these."
        findings={omissions}
      />

      <section
        aria-label="Record the review"
        className="mt-6 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="mb-1 text-sm font-semibold">Record the review</h2>
        <p className="mb-3 text-[0.7rem] text-muted-foreground">
          The manual makes the Director of Operations responsible and
          requires the reviewer&rsquo;s identity and a timestamp to be
          retained. Your name, role and the counts above are copied onto
          the record as they stand now, so it remains readable after the
          data changes.
        </p>
        <AttestForm
          findingsHash={audit.findings_hash}
          contradictions={audit.contradictions}
          omissions={audit.omissions}
          canSign={canSign}
          attestAction={attestAction}
        />
      </section>

      {audit.recent.length > 0 && (
        <section aria-label="Review history" className="mt-6">
          <h2 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Recent reviews
          </h2>
          <ul className="space-y-2">
            {audit.recent.map((a) => (
              <li
                key={a.id}
                data-testid={`attestation-${a.id}`}
                className="rounded-lg border border-border bg-card px-3 py-2"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold tabular-nums">
                    {day(a.attested_at)}
                  </span>
                  <span>{a.attested_by_name}</span>
                  <span className="text-muted-foreground">
                    · {ROLE(a.attested_by_role)}
                  </span>
                  {/* What was open at signing, always shown — the
                      record's value is that it says what was
                      outstanding, not that it says somebody signed. */}
                  <span className="text-[0.68rem] text-muted-foreground">
                    · {a.contradictions_open} contradiction
                    {a.contradictions_open === 1 ? "" : "s"},{" "}
                    {a.omissions_open} omission
                    {a.omissions_open === 1 ? "" : "s"} outstanding
                  </span>
                </div>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">
                  {a.notes}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-5 text-[0.7rem] text-muted-foreground">
        Contradictions are counted over all history and omissions over
        the {audit.cycle_days}-day window — a wrong record does not stop
        being wrong as it ages, while nobody can retroactively file a
        risk assessment for a flight last June. Fleet configuration is
        checked as it stands. Related:{" "}
        <Link href="/reports" className="text-primary hover:underline">
          Reports
        </Link>
        .
      </p>
    </div>
  );
}

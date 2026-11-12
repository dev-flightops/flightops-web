import Link from "next/link";
import type { ReactNode } from "react";

import { tab, tabList } from "@/components/ff/controls";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import {
  ACADEMY_REPORTS,
  COURSE_CATEGORIES,
  COURSE_CATEGORY_LABELS,
  CURRENCY_STATUS_LABELS,
  getAcademyReport,
  getAcademyReportFilterOptions,
  type AcademyReportFilterOptions,
  type AcademyReportKind,
  type AcademyReportParams,
  type CourseReportRow,
  type CurrencyReportRow,
  type CurrencyStatus,
  type DepartmentReportRow,
  type EmployeeReportRow,
  type OverdueReportRow,
} from "@/lib/api/academy";
import { ApiError } from "@/lib/api/client";
import { formatIsoDayLong } from "@/lib/iso-day";
import { formatRole } from "@/lib/roles";

import { AcademyHeader } from "../academy-header";
import { readReportSearch, reportHref, reportTakes, type ReportSearch } from "./params";

/**
 * /academy/reports — Academy Reports (legacy /lms/reports and its
 * report_detail.html).
 *
 * Legacy's five reports: completion by employee, by course and by
 * department, overdue training and training currency, each with its own
 * filters and an Export CSV. Legacy put them behind a hub of cards; here
 * they are one page with a tab each, as the redesign does a page's
 * sections. The academy service works out the figures (its app/reports.py
 * says what each counts, and where legacy can't carry over); this page
 * shows them, and the CSV route beside it passes the same filters on.
 */
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<CurrencyStatus, StatusTone> = {
  expired: "red",
  due_soon: "yellow",
  current: "green",
  never: "muted",
};

/** What a reader needs to read each report's figures right. */
const NOTES: Record<AcademyReportKind, string> = {
  "by-employee":
    "Assigned and overdue are as of today; From and To narrow the completions and the scores. The average score is each person's best on each quiz.",
  "by-course":
    "Passed and pass rate count the learners who took the course's quiz; a course without a quiz has neither. The average score is each learner's best.",
  "by-department": "Completion rate is completed over assigned, for the published courses in each department.",
  overdue:
    "Training is overdue when the certificate from someone's latest completion of a course has run out. It stays here while they take the course again.",
  currency: "Courses whose certificate expires. Due soon: within 30 days.",
};

/** Legacy's colours for a rate: green from 80%, amber from 50%, red below. */
function rateTone(n: number): string {
  return n >= 80 ? "text-status-green" : n >= 50 ? "text-status-yellow" : "text-status-red";
}

function percent(n: number | null) {
  return n === null ? "—" : `${n}%`;
}

function day(iso: string | null) {
  return iso ? formatIsoDayLong(iso) : "—";
}

export default async function AcademyReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportSearch>;
}) {
  const { report, filters, backwards } = readReportSearch(await searchParams);
  const meta = ACADEMY_REPORTS.find((r) => r.key === report) ?? ACADEMY_REPORTS[0];

  let options: AcademyReportFilterOptions = { roles: [], bases: [], people: [] };
  let data: { as_of: string; rows: unknown[] } | null = null;
  let loadError: string | null = null;
  if (!backwards) {
    try {
      [data, options] = await Promise.all([
        getAcademyReport(report, filters),
        // The filters' choices are a convenience: the report stands without them.
        getAcademyReportFilterOptions().catch(() => options),
      ]);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      loadError =
        status === 401
          ? "Your session expired — please sign in again."
          : status === 403
            ? "Academy reports are for the Chief Pilot, the Director of Operations and Exec Admins."
            : "Academy reports are unavailable. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <AcademyHeader
        title="Academy Reports"
        description="Training completion, overdue training and training currency across the company, each report with its own filters and a CSV export."
      />

      <nav aria-label="Report" className={`${tabList} mb-5`}>
        {ACADEMY_REPORTS.map((r) => (
          <Link
            key={r.key}
            href={reportHref(r.key, filters)}
            aria-current={r.key === report ? "page" : undefined}
            className={tab(r.key === report)}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <h2 className="section-title">{meta.title}</h2>
      <p className="mb-4 mt-1 max-w-3xl text-sm text-muted-foreground">{meta.about}</p>

      <ReportFilters report={report} filters={filters} options={options} />

      {backwards ? (
        <div role="alert" className="notice notice-yellow">
          The start date is after the end date, so there is no period to report on. Swap them and press Filter.
        </div>
      ) : loadError ? (
        <div role="alert" className="notice notice-yellow">
          {loadError}
        </div>
      ) : data ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <ReportTable report={report} rows={data.rows} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {data.rows.length} record{data.rows.length === 1 ? "" : "s"} · as of {formatIsoDayLong(data.as_of)}
          </p>
          <p className="mt-3 max-w-3xl text-xs text-muted-foreground">{NOTES[report]}</p>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/** A select's choices with the value in use kept, should the choices
 *  have failed to load or no longer hold it. */
function withCurrent(choices: { value: string; label: string }[], current: string | undefined) {
  return current && !choices.some((c) => c.value === current) ? [...choices, { value: current, label: current }] : choices;
}

function ReportFilters({
  report,
  filters,
  options,
}: {
  report: AcademyReportKind;
  filters: AcademyReportParams;
  options: AcademyReportFilterOptions;
}) {
  const takes = reportTakes(report);
  const input = "ff-input w-auto px-3 py-1.5 text-sm";
  return (
    <form
      method="get"
      action="/academy/reports"
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <input type="hidden" name="report" value={report} />
      {takes.includes("dates") ? (
        <>
          <Field label="From">
            <input type="date" name="from" defaultValue={filters.from ?? ""} className={input} />
          </Field>
          <Field label="To">
            <input type="date" name="to" defaultValue={filters.to ?? ""} className={input} />
          </Field>
        </>
      ) : null}
      {takes.includes("category") ? (
        <Field label="Department">
          <select name="category" defaultValue={filters.category ?? ""} className={input}>
            <option value="">All</option>
            {COURSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {COURSE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}
      {takes.includes("people") ? (
        <>
          <Field label="Role">
            <select name="role" defaultValue={filters.role ?? ""} className={input}>
              <option value="">All</option>
              {withCurrent(options.roles.map((r) => ({ value: r, label: formatRole(r) })), filters.role).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Base">
            <select name="base" defaultValue={filters.base ?? ""} className={input}>
              <option value="">All</option>
              {withCurrent(options.bases.map((b) => ({ value: b, label: b })), filters.base).map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employee">
            <select name="user_id" defaultValue={filters.user_id ?? ""} className={input}>
              <option value="">All</option>
              {withCurrent(options.people.map((p) => ({ value: p.id, label: p.full_name })), filters.user_id).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </>
      ) : null}
      <button type="submit" className="btn-caps rounded-md border border-input px-4 py-2 text-foreground hover:bg-accent">
        Filter
      </button>
      <Link href={`/academy/reports?report=${report}`} className="btn-caps px-2 py-2 text-muted-foreground hover:text-foreground">
        Clear
      </Link>
      <a
        href={reportHref(report, filters, true)}
        download
        className="btn-caps rounded-md border border-input px-4 py-2 text-foreground hover:bg-accent sm:ml-auto"
      >
        Export CSV
      </a>
    </form>
  );
}

function Empty({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={columns} className="py-6 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

const NUM = "text-right tabular-nums";

function ReportTable({ report, rows }: { report: AcademyReportKind; rows: unknown[] }) {
  switch (report) {
    case "by-employee":
      return <EmployeeTable rows={rows as EmployeeReportRow[]} />;
    case "by-course":
      return <CourseTable rows={rows as CourseReportRow[]} />;
    case "by-department":
      return <DepartmentTable rows={rows as DepartmentReportRow[]} />;
    case "overdue":
      return <OverdueTable rows={rows as OverdueReportRow[]} />;
    case "currency":
      return <CurrencyTable rows={rows as CurrencyReportRow[]} />;
  }
}

function EmployeeTable({ rows }: { rows: EmployeeReportRow[] }) {
  return (
    <table className="ff-table w-full text-sm">
      <thead className="ff-thead">
        <tr>
          <th>Employee</th>
          <th>Department</th>
          <th>Base</th>
          <th className="text-right">Assigned</th>
          <th className="text-right">Completed</th>
          <th className="text-right">Overdue</th>
          <th className="text-right">Avg Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <Empty columns={7}>No staff match these filters.</Empty>
        ) : (
          rows.map((r) => (
            <tr key={r.user_id}>
              <td className="font-semibold">{r.full_name}</td>
              <td className="text-muted-foreground">{r.department ?? "—"}</td>
              <td className="font-mono text-xs">{r.base ?? "—"}</td>
              <td className={NUM}>{r.assigned}</td>
              <td className={NUM}>{r.completed}</td>
              <td className={`${NUM} ${r.overdue > 0 ? "font-semibold text-status-red" : "text-muted-foreground"}`}>
                {r.overdue}
              </td>
              <td className={NUM}>{percent(r.avg_score)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function CourseTable({ rows }: { rows: CourseReportRow[] }) {
  return (
    <table className="ff-table w-full text-sm">
      <thead className="ff-thead">
        <tr>
          <th>Course</th>
          <th>Department</th>
          <th className="text-right">Assigned</th>
          <th className="text-right">Completed</th>
          <th className="text-right">Passed</th>
          <th className="text-right">Pass Rate</th>
          <th className="text-right">Avg Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <Empty columns={7}>No published course matches these filters.</Empty>
        ) : (
          rows.map((r) => (
            <tr key={r.course_id}>
              <td className="font-semibold">{r.title}</td>
              <td className="text-muted-foreground">{COURSE_CATEGORY_LABELS[r.category]}</td>
              <td className={NUM}>{r.assigned}</td>
              <td className={NUM}>{r.completed}</td>
              <td className={NUM}>{r.passed ?? "—"}</td>
              <td className={`${NUM} font-semibold ${r.pass_rate === null ? "" : rateTone(r.pass_rate)}`}>
                {percent(r.pass_rate)}
              </td>
              <td className={NUM}>{percent(r.avg_score)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function DepartmentTable({ rows }: { rows: DepartmentReportRow[] }) {
  return (
    <table className="ff-table w-full text-sm">
      <thead className="ff-thead">
        <tr>
          <th>Department</th>
          <th className="text-right">Courses</th>
          <th className="text-right">Assigned</th>
          <th className="text-right">Completed</th>
          <th className="text-right">Overdue</th>
          <th className="text-right">Completion Rate</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.category}>
            <td className="font-semibold">{COURSE_CATEGORY_LABELS[r.category]}</td>
            <td className={NUM}>{r.courses}</td>
            <td className={NUM}>{r.assigned}</td>
            <td className={NUM}>{r.completed}</td>
            <td className={`${NUM} ${r.overdue > 0 ? "font-semibold text-status-red" : "text-muted-foreground"}`}>
              {r.overdue}
            </td>
            <td className={`${NUM} font-semibold ${r.assigned ? rateTone(r.completion_rate) : "text-muted-foreground"}`}>
              {r.assigned ? `${r.completion_rate}%` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function OverdueTable({ rows }: { rows: OverdueReportRow[] }) {
  return (
    <table className="ff-table w-full text-sm">
      <thead className="ff-thead">
        <tr>
          <th>Employee</th>
          <th>Course</th>
          <th>Department</th>
          <th>Expired On</th>
          <th className="text-right">Days Overdue</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <Empty columns={5}>No overdue training.</Empty>
        ) : (
          rows.map((r) => (
            <tr key={`${r.user_id}-${r.course_id}`}>
              <td className="font-semibold">{r.full_name}</td>
              <td>{r.title}</td>
              <td className="text-muted-foreground">{COURSE_CATEGORY_LABELS[r.category]}</td>
              <td className="whitespace-nowrap text-status-red">{day(r.expired_on)}</td>
              <td className={`${NUM} font-semibold text-status-red`}>{r.days_overdue}d</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function CurrencyTable({ rows }: { rows: CurrencyReportRow[] }) {
  return (
    <table className="ff-table w-full text-sm">
      <thead className="ff-thead">
        <tr>
          <th>Employee</th>
          <th>Course</th>
          <th className="text-right">Valid</th>
          <th>Last Completed</th>
          <th>Expires</th>
          <th className="text-right">Days Left</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <Empty columns={7}>No course with an expiring certificate, or no staff match these filters.</Empty>
        ) : (
          rows.map((r) => (
            <tr key={`${r.user_id}-${r.course_id}`}>
              <td className="font-semibold">{r.full_name}</td>
              <td>{r.title}</td>
              <td className={`${NUM} text-muted-foreground`}>{r.cert_valid_days}d</td>
              <td className="whitespace-nowrap">{r.last_completed ? day(r.last_completed) : "Never"}</td>
              <td className="whitespace-nowrap">{day(r.expires_on)}</td>
              <td className={NUM}>{r.days_left === null ? "—" : `${r.days_left}d`}</td>
              <td>
                <StatusMark label={CURRENCY_STATUS_LABELS[r.status]} tone={STATUS_TONE[r.status]} />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { SegmentLinks } from "@/components/ff/segment-links";
import { StatusMark } from "@/components/ff/status-mark";
import { loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getMisReport, type MisReport, type MisRow } from "@/lib/api/drug-alcohol";
import { localDateTime } from "@/lib/format/local-time";

import { DatNav } from "../dat-nav";
import { CertifyForm } from "./certify-form";

/**
 * /employees/drug-alcohol/report, legacy's Annual MIS Summary, now the DOT
 * MIS Data Collection form itself (DOT F 1385, 49 CFR 40 appendix J; Greg,
 * 11 Nov): the annual reports of 14 CFR 120.119 (drug) and 120.219(b)
 * (alcohol), due 15 March for the year before. One form per FAA employee
 * category, each test counted under the category its person had when tested.
 *
 * Legacy cited 14 CFR 120.217 here, which is the list of tests required, and
 * measured the random rate against today's pool rather than the year's
 * average.
 */

export const dynamic = "force-dynamic";

function Table({ title, columns, rows }: { title: string; columns: string[]; rows: MisRow[] }) {
  return (
    <div className="mb-5">
      <h3 className="eyebrow mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="ff-table w-full text-xs">
          <thead className="ff-thead">
            <tr>
              <th className="min-w-[8rem]">Type of Test</th>
              {columns.map((c, i) => (
                <th key={c} className="min-w-[4.5rem] text-right align-bottom">
                  <span className="block font-mono text-muted-foreground">{i + 1}</span>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.test_type} className={r.test_type === "total" ? "font-semibold" : undefined}>
                <td>{r.label}</td>
                {r.cells.map((n, i) => (
                  <td key={columns[i]} className="text-right tabular-nums">
                    {n}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function MisReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = (await searchParams).year;
  const asked = Number.parseInt(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""), 10);
  let report: MisReport | null = null;
  let loadError: string | null = null;
  try {
    report = await getMisReport(Number.isFinite(asked) ? asked : undefined);
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 403
        ? "The MIS report is for the program's DER, the alternate DER and the Exec Admins."
        : "The MIS report is unavailable. Try refreshing in a moment.";
  }
  const zone = (await loadZoneTable()).fallback;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Annual MIS Report"
        back={{ href: "/employees/drug-alcohol", label: "Drug & Alcohol" }}
        description="The DOT MIS form (DOT F 1385) for a calendar year: 14 CFR 120.119 and 120.219(b), due 15 March"
      />
      <DatNav active="report" />
      {loadError || !report ? (
        <Notice tone="yellow" role="alert">
          {loadError ?? "The MIS report is unavailable."}
        </Notice>
      ) : (
        <Report report={report} zone={zone} />
      )}
    </div>
  );
}

function Report({ report, zone }: { report: MisReport; zone: string }) {
  const { form, certification } = report;
  const e = form.employer;
  return (
    <>
      {report.years && report.years.length > 1 ? (
        <SegmentLinks
          label="Year"
          className="mb-5"
          items={report.years.map((y) => ({
            href: `/employees/drug-alcohol/report?year=${y}`,
            label: String(y),
            active: y === form.year,
          }))}
        />
      ) : null}

      {certification ? (
        <Notice tone={certification.changed_since ? "yellow" : "green"} className="mb-4">
          Certified by {certification.official_name} on {localDateTime(certification.certified_at, zone, { withYear: true })}
          {certification.prepared_by ? `, prepared by ${certification.prepared_by}` : ""}.
          {certification.changed_since ? " Tests have changed since: the figures below differ from what was certified." : ""}
        </Notice>
      ) : null}
      {form.pending > 0 ? (
        <Notice tone="yellow" className="mb-4">
          {form.pending} test{form.pending === 1 ? " is" : "s are"} still waiting on a result and not counted. Enter the
          results before certifying.
        </Notice>
      ) : null}
      {form.covered.basis === "today" ? (
        <Notice tone="blue" className="mb-4">
          No random selection was made in {form.year}, so covered employees and the random rate are measured against
          today&rsquo;s pool. With selections, they are the average over the year&rsquo;s selections.
        </Notice>
      ) : null}
      {form.covered.unset > 0 ? (
        <Notice tone="yellow" className="mb-4">
          Some people in the pool have no FAA category: set it on the Random Pool tab.
        </Notice>
      ) : null}

      <Panel title={`I. Employer · ${form.year}`} className="mb-6">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
          {(
            [
              ["Company", e.company_name],
              ["Doing business as", e.dba],
              ["Address", e.address],
              ["Email", e.email],
              ["FAA certificate", e.faa_certificate_number],
              ["Plan / registration", e.plan_number],
              ["Certifying official", e.der_name],
              ["Telephone", e.der_phone],
              ["C/TPA", [e.ctpa_name, e.ctpa_phone].filter(Boolean).join(" · ") || null],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd>{value ?? <span className="text-muted-foreground">—</span>}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel title="II. Covered Employees" className="mb-6">
        <p className="mb-3 text-sm">
          <span className="font-semibold tabular-nums">{form.covered.total}</span> safety-sensitive employees in{" "}
          <span className="font-semibold tabular-nums">{form.covered.categories}</span> categor
          {form.covered.categories === 1 ? "y" : "ies"}
          {form.covered.basis === "average" ? `, the average over ${form.covered.selections} selection${form.covered.selections === 1 ? "" : "s"}` : ""}.
        </p>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>Random Testing</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Average Pool</th>
                <th className="text-right">Required</th>
                <th className="text-right">Done</th>
                <th>
                  <span className="sr-only">Met</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {form.random.map((r) => (
                <tr key={r.panel}>
                  <td className="capitalize">{r.panel}</td>
                  <td className="text-right tabular-nums">{r.rate_pct}%</td>
                  <td className="text-right tabular-nums">{r.average_pool}</td>
                  <td className="text-right tabular-nums">{r.required}</td>
                  <td className="text-right tabular-nums">{r.done}</td>
                  <td>
                    <StatusMark label={r.met ? "Met" : "Short"} tone={r.met ? "green" : "red"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Random positives, negatives and refusals count toward the rate; cancelled tests don&rsquo;t (14 CFR
          120.109(b)(6)).
        </p>
      </Panel>

      {form.forms.length === 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">No covered employees or tests in {form.year}.</p>
      ) : (
        form.forms.map((f) => (
          <Panel key={f.category} title={`${f.label} · ${f.employees} employee${f.employees === 1 ? "" : "s"}`} className="mb-6">
            <Table title="III. Drug Testing Data" columns={form.drug_columns} rows={f.drug} />
            <Table title="IV. Alcohol Testing Data" columns={form.alcohol_columns} rows={f.alcohol} />
          </Panel>
        ))
      )}

      {report.can_certify ? (
        <Panel title={`Certify ${form.year}`}>
          <CertifyForm year={form.year} official={e.der_name ?? ""} phone={e.der_phone ?? ""} />
        </Panel>
      ) : null}
    </>
  );
}

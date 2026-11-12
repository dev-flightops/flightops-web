import {
  ACADEMY_REPORTS,
  COURSE_CATEGORIES,
  academyReportQs,
  type AcademyReportKind,
  type AcademyReportParams,
  type CourseCategory,
} from "@/lib/api/academy";
import { isValidIsoDay } from "@/lib/iso-day";

/**
 * What /academy/reports and its CSV read from the address: the report, and
 * the filters that report takes (legacy's: By Department has no dates or
 * people, and so on). A filter the report doesn't take, or a value that
 * isn't one (a day that doesn't exist, an unknown department, a person's id
 * that isn't an id), is dropped here rather than sent to the service.
 */
export type ReportSearch = Record<string, string | string[] | undefined>;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function one(v: string | string[] | undefined): string | undefined {
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
}

export function reportTakes(report: AcademyReportKind) {
  return ACADEMY_REPORTS.find((r) => r.key === report)?.filters ?? [];
}

export function readReportSearch(search: ReportSearch): {
  report: AcademyReportKind;
  filters: AcademyReportParams;
  /** From is after To: there is no period to report on. */
  backwards: boolean;
} {
  const report = ACADEMY_REPORTS.find((r) => r.key === one(search.report))?.key ?? "by-employee";
  return { report, ...keepFor(report, read(search)) };
}

function read(search: ReportSearch): AcademyReportParams {
  const filters: AcademyReportParams = {};
  const from = one(search.from);
  const to = one(search.to);
  const category = one(search.category);
  const role = one(search.role);
  const base = one(search.base);
  const user = one(search.user_id);
  if (isValidIsoDay(from)) filters.from = from;
  if (isValidIsoDay(to)) filters.to = to;
  if (COURSE_CATEGORIES.includes(category as CourseCategory)) filters.category = category as CourseCategory;
  if (role && role.length <= 40) filters.role = role;
  if (base && base.length <= 40) filters.base = base;
  if (user && ID.test(user)) filters.user_id = user;
  return filters;
}

/** The filters `report` takes, out of `filters`. */
function keepFor(report: AcademyReportKind, filters: AcademyReportParams) {
  const takes = reportTakes(report);
  const kept: AcademyReportParams = {};
  if (takes.includes("dates")) {
    kept.from = filters.from;
    kept.to = filters.to;
  }
  if (takes.includes("category")) kept.category = filters.category;
  if (takes.includes("people")) {
    kept.role = filters.role;
    kept.base = filters.base;
    kept.user_id = filters.user_id;
  }
  for (const key of Object.keys(kept) as (keyof AcademyReportParams)[]) {
    if (kept[key] === undefined) delete kept[key];
  }
  return { filters: kept, backwards: Boolean(kept.from && kept.to && kept.from > kept.to) };
}

/** The page for `report`, keeping the filters it takes, so switching
 *  report keeps what still applies. `csv` gives its CSV instead. */
export function reportHref(report: AcademyReportKind, filters: AcademyReportParams, csv = false): string {
  const qs = academyReportQs(keepFor(report, filters).filters);
  return `/academy/reports${csv ? "/csv" : ""}?report=${report}${qs ? `&${qs.slice(1)}` : ""}`;
}

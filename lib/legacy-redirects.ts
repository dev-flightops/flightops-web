/**
 * The old site's URLs, sent to the FlightOps page that does the same job
 * (#64).
 *
 * Once the legacy site's address points at FlightOps (CUTOVER.md §3),
 * people keep arriving with its paths: bookmarks, links in old emails, a
 * URL typed from memory. Without these rules every one of them is a 404.
 *
 * The rules cover every page of the legacy app, listed in
 * legacy-routes.fixture.ts. A legacy page is either served here at the
 * same path already (/dispatch, /manifest, /safety/reports, ...) or has a
 * rule below. The tests hold both directions: every legacy page lands on
 * a FlightOps page, and no rule catches a FlightOps page.
 *
 * - Legacy ids are integers and FlightOps ids are UUIDs, and the data
 *   migration keeps no table between them, so a legacy path with an id
 *   lands on that section's list.
 * - A legacy page with no FlightOps counterpart lands on the nearest
 *   section, or on /home.
 * - Pages only, never a whole section, so legacy's JSON endpoints and HTMX
 *   pieces (/following/board-rows, /notifications/badge) have no rule. A
 *   legacy tab still open at the switch requests those with HTMX, and
 *   proxy.ts answers that by reloading the tab, which then comes through
 *   here. The booking widget other websites embed has no rule either:
 *   FlightOps has no public widget.
 * - The query string is dropped; legacy's parameters name legacy ids. A
 *   destination may carry its own, to open a FlightOps page on a tab.
 *
 * Patterns: `:id` is one all-digit segment (a legacy integer id), `:key`
 * any one segment and `:path` the rest of the path. Paths are compared
 * without a trailing slash, since legacy used both.
 */
export const LEGACY_REDIRECTS: readonly (readonly [from: string, to: string])[] = [
  // Academy (legacy's course player and studio; /lms was its first home)
  ["/academy/courses", "/academy"],
  ["/academy/assign", "/academy/assignments"],
  ["/academy/my-training", "/academy/mine"],
  ["/academy/play/:id", "/academy/mine"],
  ["/academy/play-native/:id", "/academy/mine"],
  ["/academy/studio/create", "/academy/studio/new"],
  ["/academy/studio/templates", "/academy/studio"],
  ["/academy/studio/templates/preview/:key", "/academy/studio"],
  ["/academy/studio/build/:id", "/academy/studio"],
  ["/academy/studio/edit/:id", "/academy/studio"],
  ["/academy/studio/preview/:id", "/academy/studio"],
  ["/academy/studio/versions/:id", "/academy/studio"],
  ["/lms", "/academy"],
  ["/lms/new", "/academy/studio/new"],
  ["/lms/course/:id", "/academy"],
  ["/lms/assign", "/academy/assignments"],
  ["/lms/assignments", "/academy/assignments"],
  ["/lms/dashboard", "/academy/dashboard"],
  ["/lms/reports", "/academy/reports"],
  ["/lms/reports/by-bucket", "/academy/reports"],
  ["/lms/reports/by-course", "/academy/reports"],
  ["/lms/reports/by-employee", "/academy/reports"],
  ["/lms/reports/currency", "/academy/reports"],
  ["/lms/reports/overdue", "/academy/reports"],

  // Accounting and billing
  ["/accounting/coa", "/accounting"],
  ["/accounting/export-log", "/accounting"],
  ["/accounting/schedules", "/accounting"],
  ["/acct-export", "/reservations/accounting-export"],
  ["/billing/checkout", "/settings/billing"],
  ["/billing/pricing", "/settings/billing"],
  ["/billing/success", "/settings/billing"],

  // Crew, currency and compliance
  ["/crew/members", "/compliance/roster"],
  ["/crew/members/new", "/compliance/roster"],
  ["/crew/members/:id", "/compliance/roster"],
  ["/crew/members/:id/edit", "/compliance/roster"],
  ["/crew/members/:id/duty/new", "/compliance/roster"],
  ["/crew/history/:id/duty", "/compliance/roster"],
  ["/crew/history/:id/flights", "/compliance/roster"],
  ["/crew/roster", "/compliance/roster"],
  ["/crew/assign/new", "/crew"],
  ["/crew/assign/:id/edit", "/crew"],
  ["/crew/my-dashboard", "/flight-crew"],
  ["/crew/my-history/duty", "/flight-crew/history?tab=duty"],
  ["/crew/my-history/flights", "/flight-crew/history"],
  ["/currency/fleet", "/compliance/crew-currency"],
  ["/currency/items", "/settings/currency"],
  ["/currency/pilot/:id", "/compliance/crew-currency"],
  ["/compliance", "/compliance/crew-currency"],
  ["/compliance/crew/:id", "/compliance/crew-currency"],
  ["/compliance/status-board", "/compliance/crew-currency"],
  ["/training/documents", "/settings/document-requirements"],
  ["/training/employee/:id/docs", "/employees"],
  ["/training/fleet", "/compliance/crew-currency"],
  ["/training/packages", "/academy/assignments"],
  ["/training/packages/:id", "/academy/assignments"],
  ["/training/bulk/assign-package", "/academy/assignments"],
  ["/training/bulk/log-completion", "/compliance/crew-currency"],
  ["/reports/pria", "/compliance/records-request"],
  ["/reports/pria/log", "/compliance/records-request"],
  ["/reports/pria/:id", "/compliance/records-request"],

  // Dashboards (legacy's were singular)
  ["/dashboard", "/dashboards"],
  ["/dashboard/chief-pilot", "/dashboards/chief-pilot"],
  ["/dashboard/director-ops", "/dashboards/director-ops"],
  ["/dashboard/dispatcher", "/dashboards/dispatcher"],
  ["/dashboard/executive", "/dashboards/executive"],
  ["/dashboard/ops-score", "/dashboards/ops-score"],
  ["/dashboard/station", "/dashboards/station"],
  ["/dashboard/system-health", "/dashboards/system-health"],
  ["/status", "/dashboards/system-health"],

  // Dispatch and flight following
  ["/dispatch/history", "/dispatch"],
  ["/dispatch/risk-analytics", "/dispatch"],
  ["/dispatch/ai-assist", "/dispatch/intelligence"],
  ["/dispatch/release/:id/pilot-acknowledge", "/flight-crew"],
  ["/safety/srm/frat/new", "/dispatch"],
  ["/following", "/flight-following"],
  ["/following/new", "/flight-following/new"],
  ["/following/history", "/flight-following/history"],
  ["/following/eod", "/eod"],
  ["/following/:id", "/flight-following"],
  ["/following/:id/docs", "/flight-following"],
  ["/elog", "/flight-crew/elog"],
  ["/elog/history", "/flight-crew/elog"],
  ["/elog/log/:id", "/flight-crew/elog"],

  // Ground: stations, equipment, fuel, ramp, check-in, village weather
  ["/stations/issues", "/stations"],
  ["/stations/issues/new", "/stations"],
  ["/stations/issues/:id", "/stations"],
  ["/stations/:id/edit", "/stations"],
  ["/gse", "/equipment"],
  ["/gse/add", "/equipment/new"],
  ["/gse/:id", "/equipment"],
  ["/gse/:id/edit", "/equipment"],
  ["/fuel/bases", "/fuel"],
  ["/fuel/fuel-types", "/fuel/types"],
  ["/fuel/order", "/fuel/orders/new"],
  ["/fuel/orders/:id", "/fuel/orders"],
  ["/fuel/reports/daily", "/fuel"],
  ["/fuel/supplier-portal", "/fuel/supplier"],
  ["/fuel-supplier/completed", "/fuel-supplier"],
  ["/ramper/flight/:id", "/ramper"],
  ["/ramper/fuel-orders", "/ramper"],
  ["/ramper/messages", "/ramper"],
  ["/checkin/config", "/manifest"],
  ["/checkin/flight/:id", "/manifest"],
  ["/village-wx/history/:id", "/village-wx"],
  ["/village-wx/report/:id", "/village-wx"],
  ["/weather/:id", "/weather"],

  // Maintenance
  ["/maintenance/aircraft/new", "/settings/fleet"],
  ["/maintenance/aircraft/:id", "/maintenance"],
  ["/maintenance/aircraft/:id/components", "/maintenance"],
  ["/maintenance/aircraft/:id/edit", "/settings/fleet"],
  ["/maintenance/aircraft/:id/mel", "/maintenance/mel"],
  ["/maintenance/availability-report", "/maintenance/availability"],
  ["/maintenance/calendar", "/maintenance"],
  ["/maintenance/due-list", "/maintenance"],
  ["/maintenance/inspections", "/maintenance"],
  ["/maintenance/inspections/new", "/maintenance"],
  ["/maintenance/inspections/:id", "/maintenance"],
  ["/maintenance/inventory/new", "/maintenance/inventory"],
  ["/maintenance/inventory/:id/edit", "/maintenance/inventory"],
  ["/maintenance/inventory/:id/history", "/maintenance/inventory"],
  ["/maintenance/inventory/batch-trace", "/maintenance/batch-trace"],
  ["/maintenance/inventory/expiration-report", "/maintenance/expiration"],
  ["/maintenance/parts-requests", "/maintenance/inventory"],
  ["/maintenance/shipping", "/maintenance/inventory"],
  ["/maintenance/mel/catalog", "/maintenance/mel"],
  ["/maintenance/rts-queue", "/maintenance/rts"],
  ["/maintenance/vendors", "/maintenance"],
  ["/maintenance/vendors/new", "/maintenance"],
  ["/maintenance/vendors/:id/edit", "/maintenance"],
  ["/maintenance/work-orders/new", "/maintenance/work-orders"],
  ["/maintenance/work-orders/:id", "/maintenance/work-orders"],
  ["/maintenance/work-orders/:id/task-cards", "/maintenance/work-orders"],

  // Manifest and schedule
  ["/manifest/flights/new", "/manifest"],
  ["/manifest/flights/:id", "/manifest"],
  ["/manifest/flights/:id/counter", "/manifest"],
  ["/manifest/flights/:id/docs", "/manifest"],
  ["/manifest/flights/:id/edit", "/manifest"],
  ["/manifest/flights/:id/print", "/manifest"],
  ["/manifest/flights/:id/reservations", "/manifest"],
  ["/manifest/templates", "/manifest"],
  ["/manifest/templates/:id", "/manifest"],
  ["/manifest/seasons", "/manifest"],
  ["/manifest/route-defaults", "/manifest"],
  ["/manifest/connection-times", "/manifest"],
  ["/manifest/reservations", "/reservations"],
  ["/manifest/reports/t100", "/reports/regulatory/t100"],

  // Reservations, charter, rewards and refunds
  ["/reservations/dashboard", "/reservations"],
  ["/reservations/bookings/:id/audit", "/reservations"],
  ["/reservations/agents", "/reservations"],
  ["/reservations/baggage-policies", "/reservations"],
  ["/reservations/blackouts", "/reservations"],
  ["/reservations/corporate", "/reservations"],
  ["/reservations/delay-codes", "/reservations"],
  ["/reservations/embed-settings", "/reservations"],
  ["/reservations/fare-rules", "/reservations"],
  ["/reservations/freight", "/reservations"],
  ["/reservations/my-account", "/reservations"],
  ["/reservations/orphans", "/reservations"],
  ["/reservations/pricing", "/reservations"],
  ["/reservations/scripts", "/reservations"],
  ["/reservations/tags", "/reservations"],
  ["/reservations/waitlist", "/reservations"],
  ["/reservations/sim-export", "/reports/sim"],
  ["/charter", "/reservations/charter"],
  ["/charter/new", "/reservations/charter"],
  ["/charter/rates", "/reservations/charter"],
  ["/charter/:id", "/reservations/charter"],
  // The legacy rewards program's pages
  ["/quyana", "/reservations/rewards"],
  ["/quyana/config", "/reservations/rewards"],
  ["/quyana/enroll", "/reservations/rewards"],
  ["/quyana/:id", "/reservations/rewards"],
  ["/refunds", "/reservations"],
  ["/refunds/booking/:id", "/reservations"],
  ["/refunds/invoice-email/template", "/reservations"],
  ["/refunds/invoice-emails/:id", "/reservations"],
  ["/refunds/reports/no-show", "/reservations"],
  ["/portal/charter", "/portal"],
  ["/portal/charter/flight/:id", "/portal"],

  // Reports
  ["/reports/analytics/crew", "/reports"],
  ["/reports/analytics/maintenance", "/reports"],
  ["/reports/analytics/routes", "/reports"],
  ["/reports/efficiency", "/reports"],
  ["/reports/executive", "/reports/executive/summary"],
  ["/reports/executive/bi", "/reports/bi"],
  ["/reports/executive/customers", "/reports/executive/summary"],
  ["/reports/executive/efficiency", "/reports/executive/summary"],
  ["/reports/executive/profitability", "/profitability"],
  ["/reports/executive/trending", "/reports/executive/summary"],

  // Safety
  ["/safety/hazards", "/safety"],
  ["/safety/hazards/new", "/safety/report"],
  ["/safety/hazards/:id", "/safety"],
  ["/safety/incidents/new", "/safety/incidents/report"],
  ["/safety/incidents/:id", "/safety/incidents"],
  ["/safety/reports/:id", "/safety/reports"],
  ["/safety/policy", "/safety"],
  ["/safety/srm", "/safety"],
  ["/safety/assurance", "/safety"],
  ["/safety/promotion", "/safety"],
  ["/safety/promotion/lessons/search", "/safety"],
  ["/safety/compliance", "/safety"],
  ["/safety/meetings", "/safety"],
  ["/safety/meetings/new", "/safety"],
  ["/safety/import", "/safety"],
  ["/safety/import/:id", "/safety"],
  ["/safety/bulk-import", "/safety"],
  ["/safety/bulk-import/:id/audit", "/safety"],
  ["/safety/bulk-import/:id/duplicates", "/safety"],

  // People: customers, employees, records, housing, time clock
  ["/customers/:id", "/customers"],
  ["/customers/:id/edit", "/customers"],
  ["/employees/new", "/employees"],
  ["/employees/:id", "/employees"],
  ["/records", "/employees"],
  ["/records/assign", "/employees"],
  ["/records/forms", "/employees"],
  ["/records/employee-files", "/employees"],
  ["/records/employee-files/:id", "/employees"],
  ["/records/dat", "/employees"],
  ["/records/dat/collectors", "/employees"],
  ["/records/dat/employee/:id", "/employees"],
  ["/records/dat/pool", "/employees"],
  ["/records/dat/report/annual", "/employees"],
  ["/records/dat/result-codes", "/employees"],
  ["/records/dat/selection/:id", "/employees"],
  ["/records/dat/types", "/employees"],
  ["/records/onboarding", "/employees"],
  ["/records/onboarding/assignment/:id", "/employees"],
  ["/records/onboarding/checklists", "/employees"],
  ["/records/onboarding/checklists/:id", "/employees"],
  ["/records/onboarding/employee/:id", "/employees"],
  // An employee's own tasks, reached from emailed links: home, not the
  // HR list they may not be allowed to open.
  ["/records/onboarding/my-tasks", "/home"],
  ["/records/fill/:id", "/home"],
  ["/housing/assignments", "/housing/calendar"],
  ["/housing/maintenance", "/housing"],
  ["/housing/unit/:id", "/housing"],
  ["/timeclock", "/time-clock"],
  ["/invoicing/:id", "/invoicing"],
  ["/documents/upload", "/documents"],
  ["/documents/:id", "/documents"],

  // Settings and administration
  ["/settings/tracking", "/settings/flight-tracking"],
  ["/settings/load-teams/report", "/settings/load-teams"],
  ["/settings/load-teams/dashboard/:id", "/settings/load-teams"],
  ["/settings/password", "/settings"],
  ["/settings/demo", "/settings"],
  ["/settings/nda-log", "/settings"],
  ["/settings/tenants", "/platform"],
  ["/settings/tenants/:id", "/platform"],
  ["/owner", "/platform"],
  ["/owner/companies", "/platform"],
  ["/owner/companies/new", "/platform"],
  ["/owner/companies/:id", "/platform"],
  ["/audit", "/settings"],
  ["/automation", "/settings"],
  ["/onboarding", "/settings"],
  ["/onboarding/map/:id", "/settings"],
  ["/onboarding/roadmap", "/settings"],
  ["/onboarding/roadmap/:id", "/settings"],

  // Legacy pages with no FlightOps counterpart
  ["/nda", "/home"],
  ["/force-password-change", "/home"],
  ["/notifications", "/home"],
  ["/portal/employee", "/home"],
  ["/help/articles", "/home"],
  ["/help/articles/:id/versions", "/home"],
  ["/help/contextual-links", "/home"],
  ["/recognition", "/home"],
  ["/recognition/dispatchers", "/home"],
  ["/recognition/maintenance", "/home"],
  ["/recognition/pilots", "/home"],
  ["/recognition/profile/:key/:path", "/home"],
  ["/flight-school", "/home"],
  ["/flight-school/billing", "/home"],
  ["/flight-school/instructors", "/home"],
  ["/flight-school/schedule", "/home"],
  ["/flight-school/students", "/home"],
  ["/flight-school/students/:id", "/home"],
];

const SEGMENT: Record<string, string> = {
  ":id": "\\d+",
  ":key": "[^/]+",
  ":path": ".+",
};

const RULES = LEGACY_REDIRECTS.map(
  ([from, to]) =>
    [
      new RegExp(
        `^/${from
          .split("/")
          .slice(1)
          .map((s) => SEGMENT[s] ?? s)
          .join("/")}$`,
      ),
      to,
    ] as const,
);

/** Where a legacy path now lives, or null when it is not a legacy page. */
export function legacyRedirect(pathname: string): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  for (const [pattern, to] of RULES) {
    if (pattern.test(path)) return to;
  }
  return null;
}

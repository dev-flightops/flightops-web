"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Floating red Safety Report button — fixed bottom-right of every
 * authenticated page per the formal Home Page spec, Component 6:
 *
 *   "The red Safety Report button is fixed to the bottom-right corner
 *    of every page in the app — including the home page. It is always
 *    visible regardless of scroll position. All roles see it at all
 *    times."
 *
 * A link, not a dialog. Legacy does the same — `base.html` renders
 * `<a id="safety-fab" href="/safety/reports/new?return_url=...">` — and
 * it means the global button reaches the one intake path that is
 * actually wired: /safety/report -> submitHazard -> POST /safety/hazards.
 *
 * Until now this button opened its own dialog backed by
 * `fileSafetyReportAction`, an M2-era stub that appended the filing to
 * `.safety-reports.log` and returned `{status: "ok"}`. safety-service
 * shipped in M3 with `POST /safety/hazards`, but the dialog was never
 * rewired — so every report filed from the FAB was discarded, and on
 * Vercel (read-only filesystem) it went to stdout instead. The filing
 * reached neither the Safety Officer's triage queue nor the filer's own
 * /safety/mine list, which nonetheless told them to use this button.
 *
 * The dialog's wider field set — title, report type (incl. ASAP),
 * likelihood, flight #, aircraft tail, occurrence date — was a faithful
 * port of legacy's `safety_reports` table. flightops-services has not
 * built that entity; it has `hazards` only. Those fields are parked
 * until it ships, and nothing is lost relative to the stub, which
 * persisted none of them anywhere durable.
 */
export function SafetyReportButton() {
  const pathname = usePathname();

  // The intake page is where this button goes — rendering a link to the
  // page you are already on is a dead control.
  if (pathname === "/safety/report") return null;

  const href = `/safety/report?return_url=${encodeURIComponent(pathname)}`;

  return (
    <Link
      href={href}
      aria-label="File a safety report"
      className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-[14px] bg-gradient-to-br from-red-600 to-red-700 px-[17.6px] py-[10.4px] text-[12.8px] font-bold text-white shadow-[0_4px_20px_0_rgba(220,38,38,0.45)] ring-1 ring-red-600/30 transition-transform hover:-translate-y-0.5 hover:from-red-500 hover:to-red-600"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className="flex-shrink-0"
      >
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z" />
      </svg>
      Safety
    </Link>
  );
}

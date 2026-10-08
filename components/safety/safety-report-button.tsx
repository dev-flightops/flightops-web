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
 * A link, not a dialog, to legacy's own URL: `base.html` renders
 * `<a id="safety-fab" href="/safety/reports/new?return_url=...">`.
 *
 * It files a safety report (#58), legacy's record: a title, a report
 * type (ASAP among them), where and when, flight and tail, severity and
 * likelihood, a photo. Until that entity existed the button went to the
 * hazard form, and before that to a dialog whose filings went to a log
 * file and reached nobody. Hazards are the safety team's register now,
 * filed from Safety SMS.
 */
export function SafetyReportButton() {
  const pathname = usePathname();

  // The intake page is where this button goes — rendering a link to the
  // page you are already on is a dead control.
  if (pathname === "/safety/reports/new") return null;

  const href = `/safety/reports/new?return_url=${encodeURIComponent(pathname)}`;

  return (
    <Link
      href={href}
      aria-label="File a safety report"
      className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-[14px] bg-status-red px-[17.6px] py-[10.4px] text-[12.8px] font-bold text-white shadow-[0_4px_20px_0_rgb(var(--status-red)/0.35)] ring-1 ring-status-red/30 transition hover:-translate-y-0.5 hover:brightness-95"
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

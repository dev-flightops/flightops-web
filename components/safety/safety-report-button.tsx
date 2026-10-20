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

  // #78: a square red button with an UPPERCASE label, ForeFlight's
  // idiom; the deep fill tone, so the white label reads in both modes.
  return (
    <Link
      href={href}
      aria-label="File a safety report"
      className="btn-caps fixed bottom-6 right-6 z-30 inline-flex items-center rounded-md bg-status-red-fill px-4 py-2.5 text-white shadow-[0_2px_12px_rgb(0_0_0/0.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-status-red"
    >
      Safety
    </Link>
  );
}

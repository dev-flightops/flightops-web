import { AcademyHeader } from "../academy-header";

/**
 * /academy/reports — Academy reports placeholder.
 *
 * Legacy has enrolment/completion reports here with CSV export. Lands
 * with the wider Reporting/BI surface in M4 (which pipes cross-service
 * event streams into a dedicated reporting-service).
 */
export default function AcademyReportsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="reports" />

      <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-5 text-sm">
        <p className="font-semibold text-status-yellow">
          Reports — coming in M4.
        </p>
        <p className="mt-2 text-foreground/80">
          Enrolment velocity, completion rates by role, cert-expiry
          runway, and CSV export land with the Reporting / BI vertical
          in M4. The academy-service emits every enrollment / lesson-
          completion event, so the reporting-service pipe will have
          the raw data ready when that ships.
        </p>
      </section>
    </div>
  );
}

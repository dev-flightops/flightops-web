import Link from "next/link";

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
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <AcademyHeader activeSection="reports" />

      {/* Plain language, on a neutral card: "not built yet" is not a
          warning, and a customer should not read milestone codes or
          service names. */}
      <section className="rounded-lg border border-border bg-card p-5 text-sm">
        <p className="font-semibold text-foreground">
          Academy reports aren&apos;t available yet.
        </p>
        <p className="mt-2 text-muted-foreground">
          Enrolment velocity, completion rates by role, certificate-expiry
          runway and CSV export are planned for this page. Until then,{" "}
          <Link href="/academy/assignments" className="font-medium text-primary hover:underline">
            Assignments
          </Link>{" "}
          and{" "}
          <Link href="/academy/certificates" className="font-medium text-primary hover:underline">
            Certificates
          </Link>{" "}
          show the underlying records.
        </p>
      </section>
    </div>
  );
}

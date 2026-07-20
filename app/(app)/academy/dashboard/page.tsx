import Link from "next/link";

import { AcademyHeader } from "../academy-header";

/**
 * /academy/dashboard — Academy dashboard placeholder.
 *
 * Legacy shows enrollment progress + upcoming certs + assignment
 * completion metrics here. For M3 we route learners to /academy/mine
 * for their own progress feed until the aggregate dashboard lands.
 */
export default function AcademyDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="dashboard" />

      <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-5 text-sm">
        <p className="font-semibold text-status-yellow">
          Academy dashboard — coming in a follow-up.
        </p>
        <p className="mt-2 text-foreground/80">
          The aggregate progress dashboard (enrollment velocity, certs
          expiring this quarter, assignment completion by role) lands
          once the reporting service picks up the training feed. For
          now, learners can view their own progress under{" "}
          <Link
            href="/academy/mine"
            className="text-status-blue hover:underline"
          >
            My Training
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

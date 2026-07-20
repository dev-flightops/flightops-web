import { AcademyHeader } from "../academy-header";

/**
 * /academy/assignments — Assignment roster placeholder.
 *
 * Legacy uses this tab to bulk-assign courses to roles or specific
 * employees + track their completion window. The current backend
 * only supports self-enrol (any user) and admin-assign-one (Chief
 * Pilot picks a user_id). Bulk assignment + role-based auto-assign
 * land with the next slice of the enrollment surface.
 */
export default function AcademyAssignmentsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <AcademyHeader activeSection="assignments" />

      <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 p-5 text-sm">
        <p className="font-semibold text-status-yellow">
          Assignment roster — coming in a follow-up.
        </p>
        <p className="mt-2 text-foreground/80">
          Bulk course assignment (by role or by employee list) + due-date
          tracking land once the enrollment surface extends past the
          self-enrol + admin-assign-one paths it has today. Individual
          admin-assignment already works from the Studio detail page.
        </p>
      </section>
    </div>
  );
}

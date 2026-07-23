/**
 * /reservations/quyana — legacy `templates/quyana/members.html`.
 *
 * Quyana Rewards loyalty members list. Columns: Member # · Customer
 * · Tier · Balance (green, thousands-formatted) · Lifetime · Enrolled
 * (Mon DD, YYYY). Tier badges: Elite/Gold yellow · Silver blue ·
 * Standard gray.
 *
 * No Quyana backend exists yet — the reservations-service currently
 * covers customers + bookings, not the loyalty subsystem. Renders the
 * shell with the full column set so the layout is complete for the
 * empty state; swap to `listQuyanaMembers()` once the endpoints land
 * (part of Marc's Reservations M2 story).
 */

const BACKEND_HINT =
  "Quyana Rewards ships with the reservations-service (M2 backend)";

export default function QuyanaMembersPage() {
  const total: number = 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Quyana Rewards</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} active member{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={BACKEND_HINT}
          className="cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
        >
          + Enroll Member
        </button>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Member #</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Customer</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Tier</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Balance</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">Lifetime</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No Quyana Rewards members yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

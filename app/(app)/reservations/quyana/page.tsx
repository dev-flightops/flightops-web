import { ApiError } from "@/lib/api/client";
import { getCompanyProfile } from "@/lib/api/auth";

/**
 * /reservations/quyana — Rewards Program members list.
 *
 * Legacy peregrineflight.com calls this "Quyana Rewards" (Grant's
 * branded loyalty program name). To keep the page demoable to
 * other operators, the display name is per-tenant: read
 * `rewards_program_name` off the company profile and swap it in
 * wherever the label appears. Grant sets theirs to "Quyana
 * Rewards"; a fresh tenant sees "Rewards Program".
 *
 * Backend wiring lands with the sibling PR that fills in members +
 * transactions; this page currently renders the shell against the
 * shipped label + the empty state.
 */

export const dynamic = "force-dynamic";

export default async function RewardsMembersPage() {
  let programName = "Rewards Program";
  try {
    const profile = await getCompanyProfile();
    if (profile.rewards_program_name) {
      programName = profile.rewards_program_name;
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) throw err;
    // Any other failure: fall back to the generic label — the page
    // stays useful even if the settings endpoint is briefly down.
  }

  const total: number = 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{programName}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total} active member{total === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Enrollment wires up in the sibling frontend PR"
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
                  No {programName.toLowerCase()} members yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

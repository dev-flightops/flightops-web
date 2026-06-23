import { notFound } from "next/navigation";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getPilotComplianceProfile } from "@/lib/api/ops";

import { STATUS_TOKENS } from "../../crew-currency/status-tokens";
import { CurrencyItemCard } from "./currency-item-card";
import { ProfileHeader } from "./profile-header";

/**
 * /compliance/pilots/[pilotId] — Per-pilot currency profile.
 *
 * Spec 5 §"Currency profile page":
 *   - Header: pilot name + base + overall-compliance percentage + last
 *     flight date (last-flight is a follow-up — needs the elog auto-fire
 *     to populate a "last_flight_at" projection)
 *   - Cards: one per tracked currency item, two-column grid layout
 *     (item name + regulation, status badge, last completed date, next
 *     base month due, grace ends, days until grace ends, Log Completion
 *     button, View History button)
 *   - Completion history modal (deferred — needs a separate
 *     completions endpoint with pagination)
 *   - Rolling currency display (IFR approaches / day landings / night
 *     landings) — defers to the elog auto-fire chain ingestion
 *
 * Linked-to from the compliance grid's pilot-row click + the dispatch
 * PIC dropdown click-through (PR 4c).
 */
export default async function PilotComplianceProfilePage({
  params,
}: {
  params: Promise<{ pilotId: string }>;
}) {
  const { pilotId } = await params;

  let profile;
  try {
    profile = await getPilotComplianceProfile(pilotId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {err instanceof ApiError && err.status === 401
            ? "Your session expired — please sign in again."
            : "Profile unavailable. Try refreshing in a moment."}
        </div>
      </div>
    );
  }

  const overallToken = STATUS_TOKENS[profile.overall_status];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link
        href="/compliance/crew-currency"
        className="mb-3 inline-block text-xs font-semibold text-status-blue hover:underline"
      >
        ← Back to compliance board
      </Link>

      <ProfileHeader
        pilot={profile.pilot}
        overallToken={overallToken}
        overallStatus={profile.overall_status}
        cells={profile.cells}
        items={profile.items}
      />

      <h2 className="mt-6 mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Currency items
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {profile.items.map((item) => {
          const cell = profile.cells.find(
            (c) => c.currency_item_id === item.id,
          );
          if (!cell) return null;
          return (
            <CurrencyItemCard
              key={item.id}
              item={item}
              cell={cell}
              pilotId={profile.pilot.id}
              pilotName={profile.pilot.full_name}
            />
          );
        })}
      </div>
    </div>
  );
}

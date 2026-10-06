import { notFound } from "next/navigation";
import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  getAirmanRecord,
  getPilotComplianceProfile,
  listDisqualifications,
} from "@/lib/api/ops";

import { getPilotTypeQualifications } from "@/lib/api/type-qualifications";

import { STATUS_TOKENS } from "../../crew-currency/status-tokens";
import { CurrencyItemCard } from "./currency-item-card";
import { AirmanRecordCard } from "@/components/compliance/airman-record-card";
import { ProfileHeader } from "./profile-header";
import type { CheckItemRef } from "./type-qualification-dialogs";
import { TypeQualificationsCard } from "./type-qualifications-card";
import { auth } from "@/auth";
import {
  CURRENCY_SIGNOFF,
  TYPE_QUALIFICATION_ADMINS,
  hasAnyRole,
} from "@/lib/roles";

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
  // Logging a completion is a sign-off (CURRENCY_SIGNOFF); anyone else
  // who can open this page reads it. A check ride on a type is one too;
  // authorising a position on a type is the chief pilot's call.
  const roles = (await auth())?.roles ?? [];
  const canLogCompletion = hasAnyRole(roles, CURRENCY_SIGNOFF);
  const canAuthoriseType = hasAnyRole(roles, TYPE_QUALIFICATION_ADMINS);

  let profile;
  try {
    profile = await getPilotComplianceProfile(pilotId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
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

  // Soft-failed on purpose, and fetched in parallel with each other.
  // Currency is what this page is primarily for; losing the airman
  // record should cost the reader that section, not the whole page.
  const [airman, disqualifications, typeQuals] = await Promise.all([
    getAirmanRecord(pilotId).catch(() => null),
    listDisqualifications(pilotId).catch(() => null),
    getPilotTypeQualifications(pilotId).catch(() => null),
  ]);
  // The items a type's check rides are logged against; their examiner
  // rule comes from the item, as on the currency cards.
  const checkItem = (id: string | null): CheckItemRef | null =>
    id
      ? {
          id,
          requiresExaminer:
            profile.items.find((i) => i.id === id)?.requires_examiner ?? true,
        }
      : null;

  const overallToken = STATUS_TOKENS[profile.overall_status];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/compliance/crew-currency"
        className="mb-3 inline-block text-xs font-semibold text-primary hover:underline"
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
              canLogCompletion={canLogCompletion}
            />
          );
        })}
      </div>

      {typeQuals ? (
        <TypeQualificationsCard
          data={typeQuals}
          checkItems={{
            competency: checkItem(typeQuals.check_items.competency),
            instrument: checkItem(typeQuals.check_items.instrument),
          }}
          canAuthorise={canAuthoriseType}
          canRecordCheck={canLogCompletion}
        />
      ) : null}

      {airman && disqualifications ? (
        <AirmanRecordCard
          record={airman}
          disqualifications={disqualifications}
        />
      ) : null}
    </div>
  );
}

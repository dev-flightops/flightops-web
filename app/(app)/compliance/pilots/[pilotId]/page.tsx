import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import {
  getAirmanRecord,
  getDutySettings,
  getPilotComplianceProfile,
  listDisqualifications,
  listDutyHistory,
} from "@/lib/api/ops";

import { getPilotTypeQualifications } from "@/lib/api/type-qualifications";
import { DutyHistoryTable } from "@/app/(app)/flight-crew/history/duty-history-table";

import { STATUS_TOKENS } from "../../crew-currency/status-tokens";
import { CurrencyItemCard } from "./currency-item-card";
import { AirmanRecordCard } from "@/components/compliance/airman-record-card";
import { ProfileHeader } from "./profile-header";
import { PilotWeightCard } from "./pilot-weight-card";
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
  const [airman, disqualifications, typeQuals, dutySettings] = await Promise.all([
    getAirmanRecord(pilotId).catch(() => null),
    listDisqualifications(pilotId).catch(() => null),
    getPilotTypeQualifications(pilotId).catch(() => null),
    getDutySettings().catch(() => null),
  ]);
  // The pilot's duty history, for someone the company lets correct
  // anyone's duty times (#100): a forgotten clock-out is fixed here.
  const duty = dutySettings?.can_correct_others
    ? await listDutyHistory({ userId: pilotId, limit: 10 }).catch(() => null)
    : null;
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
      <ProfileHeader
        pilot={profile.pilot}
        overallToken={overallToken}
        overallStatus={profile.overall_status}
        cells={profile.cells}
        items={profile.items}
      />

      <h2 className="eyebrow mb-3 mt-6">Currency items</h2>
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

      {profile.can_edit_weight ? (
        <PilotWeightCard pilotId={profile.pilot.id} weightLbs={profile.weight_lbs ?? null} />
      ) : null}

      {duty ? (
        <section className="mt-6" aria-labelledby="duty-history">
          <h2 id="duty-history" className="eyebrow mb-2">
            Duty history
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {`Correct a period ${profile.pilot.full_name} forgot to close or logged wrong. They see who corrected it and why.`}
          </p>
          <DutyHistoryTable periods={duty.items} pilotName={profile.pilot.full_name} />
        </section>
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

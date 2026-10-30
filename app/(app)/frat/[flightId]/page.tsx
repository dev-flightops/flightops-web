import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { FlightRiskAssessmentStep } from "@/app/(app)/flight-crew/preflight/[flightId]/step-4-frat";
import { FratOverLimitsPanel } from "@/components/dispatch/packet/frat-over-limits-panel";
import { PageHeader } from "@/components/ff/page-header";
import { FratSignoffs } from "@/components/frat/frat-signoffs";
import { getFratThresholds, loadZoneTable } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getFlight, getFratOverLimits, getLatestFratAssessment } from "@/lib/api/ops";
import type { FratAssessmentResponse } from "@/lib/api/types";
import { companyCrosswindLimitKt, nearLimitEntryKt } from "@/lib/frat/company-limits";
import { loadFratInputs } from "@/lib/frat/load-inputs";
import { localDateTime, zoneFor } from "@/lib/format/local-time";
import { FRAT_DISPATCH_SIGNERS, FRAT_OVER_LIMIT_ACCEPTORS, hasAnyRole } from "@/lib/roles";
import { routeText } from "@/lib/route";

/**
 * The flight's FRAT (#155). The client, 10/29:
 *
 *   1. One FRAT lives on each flight. Either the pilot or dispatch can create it.
 *   2. Once it's created, the FRAT can be opened right from that flight on both
 *      the pilot's schedule and dispatch's master schedule, so both sides can
 *      view and edit it from wherever they're working.
 *   3. When it's complete, the pilot and the dispatcher each check a sign-off box.
 *
 * The questionnaire is the pilot's preflight step 4, shared. Anyone on staff
 * reads it; the flight's crew and dispatch file and change it until the
 * flight is released.
 */
export default async function FratPage({ params }: { params: Promise<{ flightId: string }> }) {
  const { flightId } = await params;
  const session = await auth();
  const roles = session?.roles ?? [];
  const userId = session?.user?.id ?? null;

  let flight;
  try {
    flight = await getFlight(flightId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [frat, approval, config, zones, inputs] = await Promise.all([
    getLatestFratAssessment(flightId).catch((err): FratAssessmentResponse | null => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),
    getFratOverLimits(flightId).catch(() => null),
    getFratThresholds().catch(() => null),
    loadZoneTable(),
    loadFratInputs(flight),
  ]);
  const zone = zoneFor(zones, flight.origin);
  const dispatch = hasAnyRole(roles, FRAT_DISPATCH_SIGNERS);
  const released = flight.status !== "scheduled";
  const pilotOfFrat = frat !== null && userId !== null && frat.pilot_user_id === userId;
  // The crew file their own; dispatch files for the PIC. The release
  // stands on the FRAT, so it stays as signed once the flight is released.
  const readOnly = released || !(dispatch || roles.includes("pilot") || roles.includes("chief_pilot"));
  const blockers = frat?.release_blockers ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Flight risk assessment"
        title={`FRAT — ${flight.flight_number}`}
        description={`${localDateTime(flight.scheduled_departure_at, zone)} · ${routeText(flight)} · ${flight.aircraft.tail_number}`}
        back={
          dispatch
            ? { href: `/dispatch?flight=${flightId}`, label: "Dispatch packet" }
            : { href: "/flight-crew", label: "Flight Crew" }
        }
      />
      {released ? (
        <p role="note" className="notice notice-blue text-sm">
          <span className="notice-label">Released</span>
          <span className="text-foreground">
            The flight was released on this FRAT, so it stays as signed. Dispatch pulls the release back
            to change it.
          </span>
        </p>
      ) : blockers.length > 0 ? (
        <div role="note" className="notice notice-yellow text-sm">
          <p className="notice-label">Before release</p>
          <ul className="mt-1 list-disc pl-5 text-foreground">
            {blockers.map((b) => (
              <li key={b.code}>{b.message}</li>
            ))}
          </ul>
        </div>
      ) : frat ? (
        <p role="note" className="notice notice-green text-sm">
          <span className="notice-label">Ready</span>
          <span className="text-foreground">The FRAT is signed by both: it doesn't hold the release.</span>
        </p>
      ) : null}
      {approval ? (
        <FratOverLimitsPanel view={approval} canAccept={hasAnyRole(roles, FRAT_OVER_LIMIT_ACCEPTORS)} />
      ) : null}
      <FlightRiskAssessmentStep
        flightId={flightId}
        initial={frat}
        mode="page"
        readOnly={readOnly}
        companyCrosswindLimitKt={config ? companyCrosswindLimitKt(config, flight.aircraft.engine_count) : null}
        nearLimitEntryKt={config ? nearLimitEntryKt(config, flight.aircraft.engine_count) : null}
        demonstratedCrosswindKt={flight.aircraft.max_demonstrated_crosswind_kt}
        engineCount={flight.aircraft.engine_count}
        hasCompanyLimits={config != null}
        fratPrefill={inputs.fratPrefill}
        fratBlock={inputs.fratBlock}
        signoffs={
          frat ? (
            <FratSignoffs
              flightId={flightId}
              frat={frat}
              timeZone={zone}
              canSign={{ pilot: pilotOfFrat, dispatcher: dispatch }}
            />
          ) : null
        }
      />
    </div>
  );
}

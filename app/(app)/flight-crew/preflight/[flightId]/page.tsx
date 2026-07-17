import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import {
  getCurrentDuty,
  getFlight,
  getLatestFratAssessment,
  getLatestPilotAcceptance,
  getPreflightProgress,
} from "@/lib/api/ops";
import type {
  CurrentDutyResponse,
  FlightDetail,
  FratAssessmentResponse,
  PilotAcceptanceResponse,
  PreflightProgressResponse,
} from "@/lib/api/types";

import { PreflightShell } from "./preflight-shell";

const DUTY_OFFLINE_DEFAULT: CurrentDutyResponse = {
  open: null,
  last_closed: null,
  min_rest_hours: 9,
  max_duty_hours: 14,
  warnings: [],
};

/**
 * /flight-crew/preflight/[flightId] — 8-step gated preflight job flow
 * (Spec 4 §"8-STEP PREFLIGHT JOB FLOW").
 *
 * Layout per Spec 4 §"Step header — always visible":
 *   1. Flight context bar (flight #, route, aircraft tail, ETD) — sticky
 *   2. Progress indicator (step X of 8) with green checkmarks for done
 *   3. The active step's content area
 *
 * Server-side gating: the backend's POST /preflight/{id}/steps/{n}
 * rejects with 409 if step n-1 isn't complete, so an attacker can't
 * skip ahead even with a hand-crafted request. The frontend only
 * renders the next-required step's UI; previous steps render as
 * collapsed "Completed at HH:MMZ" rows.
 *
 * All 8 steps shipped (M2-G-7):
 *   - Step 1: Review Dispatch Release (scroll-to-bottom + ack checkbox)
 *   - Step 2: Weight and Balance Review (ack checkbox, no W&B math yet)
 *   - Step 3: Weather + NOTAM Review (one ack per routing airport)
 *   - Step 4: FRAT (LOW/MED/HIGH/EXTREME with dispatch / CP+DO
 *             authorization gates)
 *   - Step 5: Duty In confirmation (reads /duty/current)
 *   - Step 6: Accept or Deny Release (writes flight_pilot_acceptance)
 *   - Step 7: Flight Following Position Reports (ack + dispatch links)
 *   - Step 8: Post-Flight Log (handoff to /flight-crew/elog)
 */
export default async function PreflightPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight: FlightDetail | null = null;
  let progress: PreflightProgressResponse | null = null;
  let duty: CurrentDutyResponse = DUTY_OFFLINE_DEFAULT;
  let frat: FratAssessmentResponse | null = null;
  let acceptance: PilotAcceptanceResponse | null = null;
  let loadError: string | null = null;

  try {
    // Fan-out: flight + progress are required; duty + latest FRAT +
    // latest pilot acceptance are best-effort (404 / missing data is
    // normal and the step UIs handle the empty case gracefully).
    const [flightResult, progressResult, dutyResult, fratResult, acceptanceResult] =
      await Promise.all([
        getFlight(flightId),
        getPreflightProgress(flightId),
        getCurrentDuty().catch(() => DUTY_OFFLINE_DEFAULT),
        getLatestFratAssessment(flightId).catch((err) => {
          // 404 'no_assessment' is the normal pre-FRAT state.
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
        getLatestPilotAcceptance(flightId).catch((err) => {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }),
      ]);
    flight = flightResult;
    progress = progressResult;
    duty = dutyResult;
    frat = fratResult;
    acceptance = acceptanceResult;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    if (err instanceof ApiError && err.status === 401) {
      loadError = "Your session expired — please sign in again.";
    } else {
      loadError = "Couldn't load preflight progress. Try refreshing.";
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <BackLink />
        <div
          role="alert"
          className="rounded-lg border border-status-yellow/40 bg-status-yellow/10 px-4 py-3 text-sm text-status-yellow"
        >
          {loadError}
        </div>
      </div>
    );
  }
  if (!flight || !progress) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <BackLink />
      <PreflightShell
        flight={flight}
        progress={progress}
        duty={duty}
        frat={frat}
        acceptance={acceptance}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/flight-crew"
      className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      ← Flight Crew
    </Link>
  );
}

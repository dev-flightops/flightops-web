import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { getFlight, getPreflightProgress } from "@/lib/api/ops";
import type {
  FlightDetail,
  PreflightProgressResponse,
} from "@/lib/api/types";

import { PreflightShell } from "./preflight-shell";

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
 * What's in this PR:
 *   - Step 1: Review Dispatch Release (scroll-to-bottom + ack checkbox)
 *   - Step 2: Weight and Balance Review (ack checkbox, no W&B math yet)
 *   - Step 3: Weather + NOTAM Review (one ack per routing airport)
 *
 * Deferred to follow-up PRs:
 *   - Step 4 FRAT scoring (own backend table, LOW/MED/HIGH/EXTREME)
 *   - Step 5 Duty In confirmation (reads /duty/current, already live)
 *   - Step 6 Accept or Deny Release (writes flight_pilot_acceptance)
 *   - Step 7 Position reports (during flight, optional)
 *   - Step 8 Post-Flight Log (opens elog after landing)
 */
export default async function PreflightPage({
  params,
}: {
  params: Promise<{ flightId: string }>;
}) {
  const { flightId } = await params;

  let flight: FlightDetail | null = null;
  let progress: PreflightProgressResponse | null = null;
  let loadError: string | null = null;

  try {
    [flight, progress] = await Promise.all([
      getFlight(flightId),
      getPreflightProgress(flightId),
    ]);
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
      <PreflightShell flight={flight} progress={progress} />
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

import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getFratThresholds } from "@/lib/api/auth";
import type { FratThresholdConfigResponse } from "@/lib/api/types";

import { saveFratThresholdsAction } from "./actions";
import { ThresholdForm } from "./threshold-form";

/**
 * /settings/frat — where this operator's flight-risk bands begin.
 *
 * M4-B-2, and the story's framing needed correcting before it could
 * be built. It reads "ship FAR defaults, operator-overridable". There
 * is no FAR that prescribes FRAT thresholds: Part 135 does not require
 * a flight risk assessment tool at all, so there is no regulatory
 * number to default to.
 *
 * Which is the case for the override rather than against it. The FARs
 * being silent is exactly why these belong to whoever signs the
 * operator's manual, and this page says that in as many words —
 * because a screen that implied a regulatory basis would be inviting
 * an operator to leave numbers alone for a reason that does not
 * exist.
 *
 * WHAT WAS THERE BEFORE
 *
 * 15 / 25 / 35, hardcoded in ops-service's scorer, so every operator
 * on the platform scored flight risk against one operator's August
 * 2026 calibration. Legacy hardcodes 10 / 20 / 30 in its router.
 *
 * ADOPTION IS SHOWN SEPARATELY FROM THE VALUES
 *
 * A tenant sitting on the shipped numbers and one that reviewed them
 * and chose the same numbers hold identical values. The banner above
 * the form distinguishes them, and the button says "Adopt these
 * thresholds" until somebody has.
 */

export const dynamic = "force-dynamic";

/** Matches auth-service's ThresholdSetter. Reading is wider than
 *  writing — a pilot handed a HIGH should be able to see where the
 *  bands are — so the form is hidden rather than the page, and nobody
 *  types into a control that will 403. */
const SETTER_ROLES = new Set([
  "exec_admin",
  "director_of_operations",
  "chief_pilot",
]);

function day(iso: string): string {
  return iso.slice(0, 10);
}

function Provenance({ config }: { config: FratThresholdConfigResponse }) {
  if (config.adopted_at) {
    return (
      <div className="rounded-xl border border-status-green/40 bg-status-green/5 p-4">
        <h2 className="text-sm font-semibold text-status-green">
          Adopted by this operator
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Set by {config.adopted_by_name ?? "a user no longer on file"} on{" "}
          {day(config.adopted_at)}.
        </p>
        {config.rationale && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {config.rationale}
          </p>
        )}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-status-yellow/40 bg-status-yellow/5 p-4">
      <h2 className="text-sm font-semibold text-status-yellow">
        Nobody here has chosen these
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        These are the values the platform ships with —{" "}
        {config.default_medium_entry_score} /{" "}
        {config.default_high_entry_score} /{" "}
        {config.default_extreme_entry_score} — carried over from one
        operator&rsquo;s review in August 2026. They are a starting
        point, not guidance: no FAR sets FRAT thresholds, and Part 135
        does not require a FRAT at all, so there is nothing to defer
        to. Review them and save, even unchanged, and the record will
        say who did.
      </p>
    </div>
  );
}

function ReadOnlyBands({ config }: { config: FratThresholdConfigResponse }) {
  const { medium_entry_score: m, high_entry_score: h } = config;
  const { extreme_entry_score: e, max_total_score: max } = config;
  return (
    <div>
      <p className="mb-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        How a total score lands
      </p>
      <ul className="space-y-1 text-xs">
        <li>
          <span className="text-status-green">Low</span> 0–{m - 1}
        </li>
        <li>
          <span className="text-status-yellow">Medium</span> {m}–{h - 1}
        </li>
        <li>
          <span className="text-status-orange">High</span> {h}–{e - 1} —
          dispatch reviews the packet
        </li>
        <li>
          <span className="text-status-red">Extreme</span> {e}–{max} —
          needs Chief Pilot or DO authorisation
        </li>
      </ul>
      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        Setting these is the Chief Pilot&rsquo;s or the Director of
        Operations&rsquo;.
      </p>
    </div>
  );
}

export default async function FratThresholdsPage() {
  const session = await auth();
  const canSet = (session?.roles ?? []).some((r: string) =>
    SETTER_ROLES.has(r),
  );

  let config: FratThresholdConfigResponse | null = null;
  let loadError: string | null = null;
  try {
    config = await getFratThresholds();
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `auth-service refused the request (HTTP ${err.status}).`
        : "Could not reach auth-service.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav className="mb-3 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="mx-1">/</span>
        <span>Flight Risk</span>
      </nav>
      <header className="mb-4">
        <h1 className="text-2xl font-bold">Flight Risk Thresholds</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Where Low, Medium, High and Extreme begin on the pre-flight
          risk assessment
        </p>
      </header>

      {!config ? (
        <div className="rounded-xl border border-status-red/40 bg-status-red/5 p-4">
          <p className="text-sm font-semibold text-status-red">
            The thresholds could not be loaded
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <>
          <div className="mb-5">
            <Provenance config={config} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            {canSet ? (
              <ThresholdForm
                config={config}
                saveAction={saveFratThresholdsAction}
              />
            ) : (
              <ReadOnlyBands config={config} />
            )}
          </div>
          <div className="mt-5 space-y-1.5 text-[0.7rem] text-muted-foreground">
            <p>
              The questionnaire scores 18 factors from 0 to 5, so{" "}
              {config.max_total_score} is the highest total a flight can
              reach. Changing a threshold changes the band new
              assessments land in; assessments already submitted keep
              the band they were scored under.
            </p>
            <p>
              High routes the flight through dispatch via the release
              packet. Extreme cannot depart without a Chief Pilot or
              Director of Operations authorisation recorded against it —
              see{" "}
              <Link
                href="/flight-crew/preflight"
                className="text-status-blue hover:underline"
              >
                the preflight sequence
              </Link>
              .
            </p>
          </div>
        </>
      )}
    </div>
  );
}

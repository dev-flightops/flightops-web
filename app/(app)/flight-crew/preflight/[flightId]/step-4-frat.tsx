"use client";

import { useMemo, useState, useTransition } from "react";

import type {
  FratAssessmentResponse,
  FratAuthorizationKind,
  FratBlockEligibilityResponse,
  FratFactorSuggestion,
  FratPrefillResponse,
  FratRiskLevel,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

import {
  completeStepAction,
  recordFratAuthorizationAction,
  submitFratAction,
} from "./actions";

interface Props {
  flightId: string;
  /** Latest server-side assessment if any (returned by /frat/{id}/latest).
   *  When null, render the questionnaire; when present, render the
   *  result + (for EXTREME) the CP/DO authorization sub-form. */
  initial: FratAssessmentResponse | null;
  /** The operator's own crosswind limit for this aircraft, in knots,
   *  selected by engine count.
   *
   *  This replaced the AFM demonstrated figure on 22 Sep 2026, when the
   *  operator corrected the premise the wind anchors were built on:
   *  "demonstrated does not limit us... Our single engine x wind limits
   *  are 30kts multi engines are 35kts. That's a company limit. And
   *  many companies operate above the demonstrated limit."
   *
   *  Null when the settings read failed or the aircraft's engine count
   *  is not recorded — either way no limit can be named, and the factor
   *  says which rather than implying a number. */
  companyCrosswindLimitKt?: number | null;
  /** Where "near the limit" begins: the limit less the operator's
   *  margin. "Within 10 knots of a limit is near." */
  nearLimitEntryKt?: number | null;
  /** The AFM figure, shown as context beside the company limit. Worth
   *  seeing — it is a true fact about the airframe — but it is not what
   *  the factor is scored against. */
  demonstratedCrosswindKt?: number | null;
  /** Which limit applies. Null means unrecorded, which is the reason a
   *  company limit cannot be named even when one is configured. */
  engineCount?: number | null;
  /** False when the operator's FRAT policy could not be read at all,
   *  which is a different problem from an unrecorded engine count and
   *  gets a different sentence. */
  hasCompanyLimits?: boolean;
  /** Suggested scores for this flight, from data the system already
   *  holds. Null when the weather was unreachable or the prefill call
   *  failed, in which case the questionnaire behaves as it always
   *  did. */
  fratPrefill?: FratPrefillResponse | null;
  /** Whether a FRAT the pilot already filed can be carried here. */
  fratBlock?: FratBlockEligibilityResponse | null;
}

/**
 * Step 4 — Flight Risk Assessment Tool (Spec 4 §"The 8 steps / 4").
 *
 * Structure mirrors legacy `templates/safety/frat_form.html`:
 *   - 5 factor groups (Pilot / Aircraft / Environment / External / Route)
 *   - Range slider 0–5 per factor with live value display
 *   - Live total + risk level computed client-side, matching server thresholds
 *   - Mitigations textarea
 *   - Submit posts to /ops/frat/{flight_id} (server re-computes)
 *
 * Once an assessment exists for this flight + pilot:
 *   - LOW / MEDIUM   — Continue enables immediately
 *   - HIGH           — Continue enables immediately, with a soft note
 *                      reminding the pilot dispatch may hold the
 *                      release (no in-app authorization row required)
 *   - EXTREME        — must record a `cp_do_authorization` auth row
 *                      before Continue enables
 *
 * Continue calls `completeStepAction(flightId, 4, ...)` once gating is
 * cleared, advancing the preflight to Step 5.
 */

// Catalog mirrors legacy frat_form.html. Adding/removing factors here
// doesn't need a backend change — `answers` is JSONB and the server
// just sums whatever it receives.
//
// Each factor carries:
//   - `hint`    — one-line explanation of what the factor measures,
//     shown under the label so pilots don't have to guess intent.
//   - `anchors` — keyed by slider value 0..5, describing what that
//     value means in Part 135 bush-Alaska terms. Rendered live under
//     the slider so a pilot picking 3 sees "borderline" context
//     immediately instead of a bare integer. Sparse maps are fine —
//     `anchorFor()` picks the nearest defined key ≤ value so 1/2/4
//     can inherit from 0/3.
interface FratFactor {
  code: string;
  label: string;
  hint: string;
  anchors: Record<number, string>;
}
const FACTOR_GROUPS: ReadonlyArray<{
  group: string;
  factors: ReadonlyArray<FratFactor>;
}> = [
  {
    group: "Pilot Factors",
    factors: [
      {
        code: "pilot_rest",
        label: "Rest in last 24h",
        hint: "Sleep quality + subjective alertness heading into this flight.",
        anchors: {
          0: "8+ hrs quality sleep · fully alert",
          2: "6–7 hrs sleep · functional but not sharp",
          4: "5 hrs or broken sleep · alertness diminished",
          5: "≤4 hrs sleep or acutely fatigued",
        },
      },
      {
        code: "pilot_currency",
        label: "Aircraft currency & recent hours",
        hint: "Flown this type recently? Comfortable with the cockpit flow?",
        anchors: {
          0: "Flew this type in last 7 days · fully current",
          2: "Within 30-day currency · a little rusty",
          4: "Near edge of Part 61 currency window",
          5: "Marginal or requalifying — recent lapse",
        },
      },
      {
        code: "pilot_duty",
        label: "Duty day length",
        hint: "Where in the 14-hour ceiling is this flight landing?",
        anchors: {
          0: "First flight, well under 8h of duty",
          2: "8–10h into duty, still fresh",
          4: "10–12h in — heading toward the ceiling",
          5: "Past 12h, or reduced rest yesterday",
        },
      },
      {
        code: "pilot_health",
        label: "Health / IMSAFE",
        hint: "Illness, Medication, Stress, Alcohol, Fatigue, Emotion.",
        anchors: {
          0: "IMSAFE all clear · fit to fly",
          2: "Minor cold or off-day, no meds",
          4: "OTC meds, mild illness, life stressors",
          5: "Any IMSAFE flag you'd hesitate to sign for",
        },
      },
    ],
  },
  {
    group: "Aircraft Factors",
    factors: [
      {
        code: "ac_maintenance",
        label: "Maintenance status",
        hint: "MEL items, deferred squawks, upcoming inspection windows.",
        anchors: {
          0: "No open items, well inside inspection intervals",
          2: "1–2 minor non-flight-critical squawks",
          4: "MEL item(s) deferred or inspection imminent",
          5: "Discretionary release — multiple deferrals",
        },
      },
      {
        code: "ac_performance",
        label: "Performance margin",
        hint: "Weight, altitude, temperature vs. the aircraft's book numbers.",
        anchors: {
          0: "Well within 20% of book at full load",
          2: "Standard day, near typical loads",
          4: "Weight × density-altitude squeezes margin",
          5: "At or over performance-chart limits",
        },
      },
      {
        code: "ac_equipment",
        label: "Equipment & avionics readiness",
        hint: "Nav, comm, radar, autopilot — everything you rely on.",
        anchors: {
          0: "All systems nominal, backups verified",
          2: "One redundant system degraded (still legal)",
          4: "Required equipment marginal or intermittent",
          5: "Required equipment inop w/ deferral",
        },
      },
    ],
  },
  {
    group: "Environment / Weather",
    factors: [
      {
        code: "wx_ceiling",
        label: "Ceiling",
        hint: "Cloud-base height above the highest terrain along the route.",
        anchors: {
          0: "Broken/overcast above 3000 ft AGL",
          2: "Ceilings 1500–3000 ft AGL",
          4: "Ceilings 500–1500 ft AGL / low MVFR",
          5: "Near approach minimums along route",
        },
      },
      {
        code: "wx_vis",
        label: "Visibility",
        hint: "Prevailing horizontal visibility en route + at destination.",
        anchors: {
          0: ">6 SM everywhere",
          2: "3–6 SM · MVFR",
          4: "1–3 SM · IFR",
          5: "Near minimums or reduced by precip / smoke",
        },
      },
      {
        code: "wx_wind",
        label: "Wind & gusts",
        hint: "Sustained + gust factor vs. the aircraft's crosswind limit.",
        anchors: {
          0: "<10 kt · calm to light",
          2: "10–18 kt · manageable gust factor",
          4: "18–25 kt · near aircraft crosswind limit",
          5: "Above crosswind limit or gusts >25 kt",
        },
      },
      {
        code: "wx_icing",
        label: "Icing conditions",
        hint: "PIREPs, forecast icing, freezing level along the cruise band.",
        anchors: {
          0: "No icing forecast · well above freezing",
          2: "Trace/light forecast, avoidable",
          4: "Light–moderate in cruise band",
          5: "Moderate+ forecast or PIREP on route",
        },
      },
      {
        code: "wx_turb",
        label: "Turbulence forecast",
        hint: "AIRMETs, SIGMETs, PIREPs for chop en route.",
        anchors: {
          0: "Smooth to light forecast",
          2: "Occasional light, none reported",
          4: "Moderate en route or over terrain",
          5: "Severe forecast or PIREP on route",
        },
      },
    ],
  },
  {
    group: "External Pressures",
    factors: [
      {
        code: "ext_schedule",
        label: "Schedule pressure",
        hint: '"Get-there-itis" from delays, missed slots, or crew swaps.',
        anchors: {
          0: "On time · no downstream impact",
          2: "Late by 30–60 min · recoverable",
          4: "Late enough to affect crew rest or connections",
          5: "Would push a duty limit or misconnect crew",
        },
      },
      {
        code: "ext_passengers",
        label: "Passenger expectations / VIPs",
        hint: "Who's on board and what do they expect of this flight?",
        anchors: {
          0: "Routine load, no external expectations",
          2: "Owner/regular charter on board",
          4: "High-visibility flight or VIP passengers",
          5: '"Have-to-go" pressure, cannot be delayed',
        },
      },
      {
        code: "ext_ops",
        label: "Ops / dispatch pressure",
        hint: "Nudges from dispatch, chief pilot, or ops leadership.",
        anchors: {
          0: "None · dispatch neutral",
          2: "Dispatch checking status regularly",
          4: "Explicit pressure to accept borderline conditions",
          5: "Told to fly against your own judgment",
        },
      },
    ],
  },
  {
    group: "Route / Terrain",
    factors: [
      {
        code: "route_terrain",
        label: "Terrain challenge",
        hint: "Elevation and obstacles under the planned track.",
        anchors: {
          0: "Flat delta or coastline",
          2: "Rolling terrain with scattered obstacles",
          4: "Mountains with defined pass routing",
          5: "High mountainous, single-engine-out-of-glide",
        },
      },
      {
        code: "route_remote",
        label: "Remoteness & SAR access",
        hint: "How long until search-and-rescue could reach you?",
        anchors: {
          0: "Anchorage bowl · SAR minutes away",
          2: "Hub village · day-only SAR",
          4: "Remote village · hours to SAR",
          5: "Truly remote · SAR may not launch until next day",
        },
      },
      {
        code: "route_airport",
        label: "Destination airport challenge",
        hint: "Surface, length, lighting, familiarity, obstructions.",
        anchors: {
          0: "Paved, lit, published approach, familiar",
          2: "Gravel/unlit but flown recently",
          4: "Short strip or unfamiliar destination",
          5: "One-way strip, tight terrain, or first time here",
        },
      },
    ],
  },
];

/** Pick the anchor whose key is the greatest ≤ value. Callers get a
 *  useful string even when a factor only defined 0/2/4/5. */
function anchorFor(anchors: Record<number, string>, value: number): string {
  const keys = Object.keys(anchors)
    .map(Number)
    .filter((k) => k <= value)
    .sort((a, b) => a - b);
  const chosen = keys.length ? keys[keys.length - 1] : 0;
  return anchors[chosen] ?? "";
}

function scoreToRiskLevel(score: number): FratRiskLevel {
  // Thresholds shifted +5 (Aug 2026 recalibration) so the recalibrated bands
  // are: LOW <15 · MEDIUM 15–24 · HIGH 25–34 · EXTREME 35+.
  // Backend `score_to_risk_level` in services/ops/app/routes/frat.py
  // must stay in lockstep — the server re-computes on submit and
  // rejects mismatches.
  if (score < 15) return "low";
  if (score < 25) return "medium";
  if (score < 35) return "high";
  return "extreme";
}

const RISK_BAND_CLASSES: Record<FratRiskLevel, string> = {
  low: "border-status-green/40 bg-status-green/10 text-status-green",
  medium: "border-status-yellow/40 bg-status-yellow/10 text-status-yellow",
  high: "border-status-yellow/60 bg-status-yellow/15 text-status-yellow",
  extreme: "border-status-red/40 bg-status-red/10 text-status-red",
};
const RISK_LABEL: Record<FratRiskLevel, string> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  extreme: "EXTREME",
};

export function FlightRiskAssessmentStep({
  flightId,
  initial,
  companyCrosswindLimitKt,
  nearLimitEntryKt,
  demonstratedCrosswindKt,
  engineCount,
  hasCompanyLimits = true,
  fratPrefill,
  fratBlock,
}: Props) {
  // Pilots reach this component in two modes:
  //   1. First-time — no assessment yet, render the questionnaire.
  //   2. Post-submit — assessment exists, render the result + Continue.
  // Review item #6 (Aug 2026) added an Edit link to completed steps in the
  // preflight shell. For FRAT specifically, "editing" means retaking
  // the questionnaire — a new assessment row is written and becomes
  // the latest. The result panel exposes a "Retake questionnaire"
  // link that flips this local override so we re-render the empty
  // questionnaire without needing a route change.
  const [override, setOverride] = useState(false);
  if (!initial || override) {
    return (
      <FratQuestionnaire
        flightId={flightId}
        companyCrosswindLimitKt={companyCrosswindLimitKt}
        nearLimitEntryKt={nearLimitEntryKt}
        demonstratedCrosswindKt={demonstratedCrosswindKt}
        engineCount={engineCount}
        hasCompanyLimits={hasCompanyLimits}
        fratPrefill={fratPrefill}
        fratBlock={fratBlock}
      />
    );
  }
  return (
    <FratResultPanel
      flightId={flightId}
      assessment={initial}
      onRetake={() => setOverride(true)}
    />
  );
}

// ---------------------------------------------------------------------------
// Questionnaire (no assessment yet)
// ---------------------------------------------------------------------------

function FratQuestionnaire({
  flightId,
  fratPrefill,
  fratBlock,
  companyCrosswindLimitKt,
  nearLimitEntryKt,
  demonstratedCrosswindKt,
  engineCount,
  hasCompanyLimits,
}: {
  flightId: string;
  fratPrefill?: FratPrefillResponse | null;
  fratBlock?: FratBlockEligibilityResponse | null;
  companyCrosswindLimitKt?: number | null;
  nearLimitEntryKt?: number | null;
  demonstratedCrosswindKt?: number | null;
  engineCount?: number | null;
  hasCompanyLimits?: boolean;
}) {
  /** Suggestions keyed by factor, for seeding and for the provenance
   *  line under each one. */
  const suggested = new Map(
    (fratPrefill?.suggestions ?? []).map((s) => [s.factor, s]),
  );

  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const group of FACTOR_GROUPS)
      for (const f of group.factors) {
        // Seeded from the prefill where there is one, 0 otherwise.
        //
        // Note what this does NOT fix: a factor with no suggestion
        // still starts at 0, and a pilot can still submit the form
        // untouched. Prefilling makes the fast path accurate for the
        // factors the system knows; it does not stop an unscored
        // submission, which is a separate change.
        const hint = (fratPrefill?.suggestions ?? []).find(
          (x) => x.factor === f.code,
        );
        init[f.code] = hint?.score ?? 0;
      }
    return init;
  });
  const [mitigations, setMitigations] = useState("");
  /** Factors the pilot has moved. Distinct from "not zero": moving a
   *  slider to 0 deliberately is an assessment, and leaving it at 0
   *  untouched is not. */
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => Object.values(answers).reduce((sum, v) => sum + v, 0),
    [answers],
  );
  const risk = scoreToRiskLevel(total);

  /**
   * Factors sitting at 0 that nobody has actually assessed.
   *
   * Every factor starts at 0, so an untouched form scores 0 and files
   * as LOW with approval "not required". Walking the preflight on 23
   * September confirmed a pilot can submit all eighteen that way: the
   * fast path was an unscored assessment that looked scored, and
   * nothing on the screen said so.
   *
   * A factor counts as assessed if the pilot moved it, or if the
   * prefill scored it — a prefilled value the pilot leaves alone is
   * one they have seen and accepted, which is the whole point of
   * showing its provenance. What is left is the set nobody has
   * answered, and 0 is being read as their answer.
   *
   * Prefilling shrinks this set; it does not empty it. Seven more
   * factors are auto-fillable and eight are not, so this stays
   * relevant even when the prefill is finished.
   */
  const unassessed = FACTOR_GROUPS.flatMap((g) => g.factors)
    .map((f) => f.code)
    .filter(
      (code) =>
        answers[code] === 0 &&
        !touched.has(code) &&
        suggested.get(code)?.score == null,
    );

  const submit = (affirmed: boolean) => {
    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await submitFratAction(flightId, {
        answers,
        // The pilot's own words, and only theirs. This used to have the
        // affirmation appended to it as a sentence, which mixed the
        // record into their text, could not be queried, and was
        // editable by the person it recorded. It has a column now.
        mitigations: mitigations.trim() || undefined,
        // Sent only when the question was actually put to them. An
        // empty array would say "asked, affirmed nothing", which is a
        // different claim from "never asked" — the backend keeps those
        // apart, so the caller has to as well.
        ...(affirmed && unassessed.length > 0
          ? { affirmed_zero_factors: unassessed }
          : {}),
      });
      if (!result.ok) setError(result.error);
    });
  };

  const handleSubmit = () => {
    // Not a block. The operator asked for a FRAT that takes seconds,
    // and refusing to submit would fight that. What it stops is doing
    // it *silently*: the count is named, and confirming turns a
    // default into a deliberate answer.
    if (unassessed.length > 0) {
      setConfirming(true);
      return;
    }
    submit(false);
  };

  /**
   * Accept the carried block. One press, as asked for.
   *
   * Files the *carried* answers, not the questionnaire's current state.
   * The form is seeded from this leg's prefill and zero everywhere
   * else, so submitting it would file different numbers from the
   * assessment the panel says it is carrying — every factor the
   * prefill cannot reach (IMSAFE, maintenance, terrain, remoteness)
   * arriving as a zero nobody assessed, and the filed risk coming out
   * lower than the real one.
   *
   * It also skips the unassessed-factor confirmation, deliberately.
   * That guard exists to stop a pilot filing eighteen untouched zeros
   * as LOW. A carried assessment is the opposite case: the numbers came
   * from a questionnaire this pilot actually answered, which is what a
   * block FRAT *is*. Making them confirm them again would turn the one
   * button the operator asked for into two — and the confirmation
   * renders at the bottom of the form, so from the top of the page the
   * press looks like it did nothing at all.
   */
  const handleAcceptBlock = () => {
    const carried = fratBlock?.source_answers;
    const sourceId = fratBlock?.source_assessment_id;
    if (!carried || !sourceId) return;

    setError(null);
    setConfirming(false);
    startTransition(async () => {
      const result = await submitFratAction(flightId, {
        answers: carried,
        mitigations: mitigations.trim() || undefined,
        carried_from_assessment_id: sourceId,
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 4
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Flight Risk Assessment Tool (FRAT)
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Score each factor 0–5. Total determines risk level: LOW &lt;15 ·
          MEDIUM 15–24 · HIGH 25–34 · EXTREME 35+.
        </p>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        {/* Carry the last FRAT forward, which is what the operator
            asked for:

              bases that are launching flights every 15-30 minutes to
              the same locations... a pilot can press one button like
              "accept new weight and balance no other changes to flight
              risk necessary"

            Offered, never automatic. The button files a fresh
            assessment with the carried answers rather than reusing the
            old row, so every leg still has its own record with its own
            timestamp — a block that made one assessment cover several
            legs would leave the later ones with no record of their
            own.

            When it is not available the reasons are shown instead of
            being hidden, because "your last FRAT is 5.2h old and the
            block lasts 4h" tells a pilot something, and an absent
            button tells them nothing. */}
        {fratBlock?.eligible &&
        fratBlock.source_assessment_id &&
        fratBlock.source_answers ? (
          <div className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-3 text-xs">
            <p className="font-semibold uppercase tracking-[0.06em] text-status-green">
              Your last FRAT can be carried to this leg
            </p>
            <p className="mt-1 text-foreground">
              Filed at{" "}
              <span className="font-semibold">
                {fratBlock.source_risk_level?.toUpperCase()}
              </span>
              , valid for this block until{" "}
              <span className="font-semibold tabular-nums">
                {formatBlockExpiry(fratBlock.expires_at)}
              </span>
              . Nothing the system scores has worsened since.
            </p>
            <p className="mt-1 text-muted-foreground">
              Checked: wind, ceiling, visibility, rest and duty against
              your operator&rsquo;s limits. Not checked: aircraft swap,
              crew change, NOTAMs. Retake it below if anything else has
              changed.
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={handleAcceptBlock}
              className="mt-2.5 rounded-md bg-status-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
            >
              {pending
                ? "Filing…"
                : "Accept new weight & balance — no other changes"}
            </button>
          </div>
        ) : fratBlock && fratBlock.reasons.length > 0 ? (
          <div className="rounded-md border border-border bg-background px-3 py-2.5 text-[0.7rem] text-muted-foreground">
            <span className="font-semibold text-foreground">
              A new assessment is needed for this leg.
            </span>{" "}
            {fratBlock.reasons.join(" ")}
          </div>
        ) : null}

        {FACTOR_GROUPS.map((group) => (
          <div key={group.group}>
            <h3 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-primary">
              {group.group}
            </h3>
            <div className="space-y-3">
              {group.factors.map((f) => (
                <FactorRow
                  key={f.code}
                  factor={f}
                  suggestion={suggested.get(f.code)}
                  companyCrosswindLimitKt={companyCrosswindLimitKt}
                  nearLimitEntryKt={nearLimitEntryKt}
                  demonstratedCrosswindKt={demonstratedCrosswindKt}
                  engineCount={engineCount}
                  hasCompanyLimits={hasCompanyLimits}
                  value={answers[f.code]}
                  onChange={(v) => {
                    setAnswers((prev) => ({ ...prev, [f.code]: v }));
                    // Moving it counts even when it lands on 0 — a
                    // deliberate zero is an assessment.
                    setTouched((prev) => new Set(prev).add(f.code));
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="grid grid-cols-3 gap-3 border-t border-border pt-4">
          <Tile label="Total Score" value={String(total)} />
          <Tile
            label="Risk Level"
            value={RISK_LABEL[risk]}
            valueClass={
              risk === "extreme"
                ? "text-status-red"
                : risk === "high"
                  ? "text-status-yellow"
                  : risk === "medium"
                    ? "text-status-yellow"
                    : "text-status-green"
            }
          />
          <Tile
            label="Approval"
            value={
              risk === "extreme"
                ? "CP / DO"
                : risk === "high"
                  ? "Dispatch"
                  : "Not required"
            }
            valueClass={
              risk === "extreme" || risk === "high"
                ? "text-status-yellow text-sm"
                : "text-muted-foreground text-sm"
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Mitigations applied (optional)
          </label>
          <textarea
            value={mitigations}
            onChange={(e) => setMitigations(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="What risk controls were applied for this flight…"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Named before it is filed, not blocked.
            The operator asked for a FRAT that takes seconds, so
            refusing to submit would fight the request. What this stops
            is doing it silently: an untouched form scores 0 and files
            as LOW with approval "not required", and before this there
            was nothing on the screen to say the score was of nothing. */}
        {unassessed.length > 0 && !confirming ? (
          <p className="text-[0.7rem] text-status-yellow">
            <span className="font-semibold tabular-nums">
              {unassessed.length}
            </span>{" "}
            of {FACTOR_GROUPS.flatMap((g) => g.factors).length} factors
            are still at zero and have not been assessed. Scoring them
            makes the total mean something; submitting as-is will ask you
            to confirm they are genuinely zero.
          </p>
        ) : null}

        {confirming ? (
          <div
            role="alertdialog"
            aria-label="Confirm unassessed factors"
            className="space-y-2 rounded-md border border-status-yellow/50 bg-status-yellow/10 px-3 py-3 text-xs"
          >
            <p className="font-semibold uppercase tracking-[0.06em] text-status-yellow">
              {unassessed.length} factor
              {unassessed.length === 1 ? "" : "s"} not assessed
            </p>
            <p className="text-foreground">
              These are still at zero because nobody has answered them,
              not because the risk is zero. Filing now records them as
              zero and the total as{" "}
              <span className="font-semibold">{risk}</span>.
            </p>
            <p className="text-muted-foreground">
              {unassessed
                .map(
                  (code) =>
                    FACTOR_GROUPS.flatMap((g) => g.factors).find(
                      (f) => f.code === code,
                    )?.label ?? code,
                )
                .join(" · ")}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md bg-primary px-3 py-1.5 font-semibold text-white hover:bg-brand-dark"
              >
                Go back and score them
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => submit(true)}
                className="rounded-md border border-border px-3 py-1.5 font-semibold text-foreground hover:bg-card disabled:opacity-50"
              >
                They are genuinely zero — file it
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={handleSubmit}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-brand-dark disabled:opacity-50"
          >
            {pending ? "Submitting…" : "Submit assessment"}
          </button>
        )}

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function FactorRow({
  factor,
  value,
  onChange,
  suggestion,
  companyCrosswindLimitKt,
  nearLimitEntryKt,
  demonstratedCrosswindKt,
  engineCount,
  hasCompanyLimits,
}: {
  factor: FratFactor;
  value: number;
  onChange: (v: number) => void;
  suggestion?: FratFactorSuggestion;
  companyCrosswindLimitKt?: number | null;
  nearLimitEntryKt?: number | null;
  demonstratedCrosswindKt?: number | null;
  engineCount?: number | null;
  hasCompanyLimits?: boolean;
}) {
  const anchor = anchorFor(factor.anchors, value);
  // Value tone follows the risk palette so pilots can see at a glance
  // which factors they've flagged high. 0–1 green · 2–3 yellow · 4–5 red.
  const valueClass =
    value >= 4
      ? "text-status-red"
      : value >= 2
        ? "text-status-yellow"
        : "text-status-green";

  return (
    <div className="grid grid-cols-12 items-start gap-2">
      <div className="col-span-8">
        <label
          htmlFor={`factor-${factor.code}`}
          className="block text-xs font-semibold text-foreground"
        >
          {factor.label}
        </label>
        <p className="text-[0.65rem] leading-snug text-muted-foreground">
          {factor.hint}
        </p>
        {/* The wind anchors are written in terms of "the aircraft's
            crosswind limit". Until this was stored, the pilot had to
            supply that number from memory while scoring against it. */}
        {/* Where a prefilled number came from.
            A suggested score with no provenance is worse than an empty
            field: it looks authoritative and the pilot cannot check
            it. So every seeded factor says what it was derived from,
            and a factor the system could not score says which input
            was missing rather than sitting silently at 0. */}
        {suggestion ? (
          <p
            className={cn(
              "mt-0.5 text-[0.65rem] leading-snug",
              suggestion.score != null
                ? "text-status-blue"
                : "text-status-yellow",
            )}
          >
            {suggestion.score != null ? (
              <>
                Prefilled from{" "}
                <span className="text-muted-foreground">
                  {suggestion.source}
                </span>
                . Change it if you disagree.
              </>
            ) : (
              <>Not prefilled — {suggestion.unavailable_reason}</>
            )}
          </p>
        ) : null}

        {factor.code === "wx_wind" ? (
          <p className="mt-0.5 text-[0.65rem] leading-snug">
            {companyCrosswindLimitKt != null ? (
              <span className="text-foreground">
                Company limit:{" "}
                <span className="font-semibold tabular-nums">
                  {companyCrosswindLimitKt} kt
                </span>{" "}
                <span className="text-muted-foreground">
                  {engineCount === 1 ? "single-engine" : "multi-engine"}
                  {nearLimitEntryKt != null && nearLimitEntryKt > 0 ? (
                    <>
                      {" "}
                      &middot; near from{" "}
                      <span className="tabular-nums">
                        {nearLimitEntryKt} kt
                      </span>
                    </>
                  ) : null}
                </span>
                {demonstratedCrosswindKt != null ? (
                  <span className="text-muted-foreground/70">
                    {" "}
                    &middot; AFM demonstrated{" "}
                    <span className="tabular-nums">
                      {demonstratedCrosswindKt} kt
                    </span>
                  </span>
                ) : null}
              </span>
            ) : hasCompanyLimits === false ? (
              <span className="italic text-status-yellow">
                Company crosswind limits could not be loaded — score
                against your GOM limit.
              </span>
            ) : (
              <span className="italic text-status-yellow">
                Engine count not recorded for this aircraft, so no company
                crosswind limit applies to it yet — score against your GOM
                limit. An admin can set it under Settings &rarr; Fleet.
              </span>
            )}
          </p>
        ) : null}
      </div>
      <div className="col-span-4 flex flex-col items-stretch gap-1">
        <div className="flex items-center gap-2">
          <input
            id={`factor-${factor.code}`}
            type="range"
            min={0}
            max={5}
            step={1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-describedby={`factor-${factor.code}-anchor`}
            className="flex-1 accent-primary"
          />
          <span
            className={cn(
              "w-4 text-right font-mono text-sm font-bold",
              valueClass,
            )}
          >
            {value}
          </span>
        </div>
        <p
          id={`factor-${factor.code}-anchor`}
          className={cn("text-right text-[0.65rem] leading-snug", valueClass)}
        >
          {anchor}
        </p>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-center">
      <div className={cn("text-xl font-bold text-foreground", valueClass)}>
        {value}
      </div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result panel (assessment submitted)
// ---------------------------------------------------------------------------

function FratResultPanel({
  flightId,
  assessment,
  onRetake,
}: {
  flightId: string;
  assessment: FratAssessmentResponse;
  onRetake: () => void;
}) {
  const risk = assessment.risk_level;
  // Named by the server, so the client cannot disagree with it about
  // what "out of company limits" means.
  const overLimits = assessment.over_limit_factors ?? [];
  const overLimitLabels = overLimits
    .map(
      (code) =>
        FACTOR_GROUPS.flatMap((g) => g.factors).find((f) => f.code === code)
          ?.label ?? code,
    )
    .join(" · ");
  // Only EXTREME hard-gates the pilot behind an authorization row.
  // HIGH used to require a `dispatch_contact` gate on this screen —
  // The Aug 2026 review removed it: dispatch controls whether the packet
  // is released, and a pilot can still call to discuss. HIGH pilots
  // continue immediately; dispatch pulls the release if they don't
  // want the flight to fly. See PR #205 for the change rationale.
  const requiredKind: FratAuthorizationKind | null =
    risk === "extreme" ? "cp_do_authorization" : null;
  const hasRequiredAuth =
    requiredKind === null ||
    assessment.authorizations.some((a) => a.kind === requiredKind);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeStepAction(flightId, 4, {
        frat_assessment_id: assessment.id,
        total_score: assessment.total_score,
        risk_level: assessment.risk_level,
      });
      if (!result.ok) setError(result.error ?? "Couldn't continue.");
    });
  };

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Step 4
        </p>
        <h2 className="text-base font-semibold text-foreground">
          Flight Risk Assessment Tool (FRAT)
        </h2>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Total Score" value={String(assessment.total_score)} />
          <Tile
            label="Risk Level"
            value={RISK_LABEL[risk]}
            valueClass={
              risk === "extreme"
                ? "text-status-red"
                : risk === "high" || risk === "medium"
                  ? "text-status-yellow"
                  : "text-status-green"
            }
          />
          <Tile
            label="Approval"
            // "Not required" was printed for a flight over company
            // limits, because the band was LOW. The no-go outranks the
            // band on this tile for the same reason it outranks it
            // everywhere else.
            value={
              overLimits.length > 0
                ? "No-go"
                : risk === "extreme"
                  ? hasRequiredAuth
                    ? "Cleared"
                    : "Pending"
                  : risk === "high"
                    ? "Dispatch reviews"
                    : "Not required"
            }
            valueClass={
              overLimits.length > 0
                ? "text-status-red text-sm"
                : risk === "extreme"
                  ? hasRequiredAuth
                    ? "text-status-green text-sm"
                    : "text-status-yellow text-sm"
                  : risk === "high"
                    ? "text-status-yellow text-sm"
                    : "text-muted-foreground text-sm"
            }
          />
        </div>

        {overLimits.length > 0 && (
          /* The operator, 25 September:
               "Over company limits is a no go. Higher risk is something
                to caution dispatchers and pilots before heading out the
                door."
             So this is not a louder risk band — it is a different
             answer, and it has to survive a low total. A flight with
             the wind over the company crosswind limit and everything
             else genuinely zero totals 5, lands in LOW, and used to
             print "Not required" on the approval line. */
          <div
            role="alert"
            className="rounded-md border border-status-red/50 bg-status-red/10 px-3 py-3 text-xs"
          >
            <p className="font-semibold uppercase tracking-[0.06em] text-status-red">
              Over company limits — this flight is a no-go
            </p>
            <p className="mt-1 text-foreground">
              {overLimits.length === 1 ? "This factor is" : "These factors are"}{" "}
              scored out of company limits:{" "}
              <span className="font-semibold">{overLimitLabels}</span>. That is
              not a risk level to accept — the flight does not go until the
              condition changes or the load does.
            </p>
            <p className="mt-1 text-muted-foreground">
              Call dispatch. If you scored one of these by mistake, retake the
              questionnaire below.
            </p>
          </div>
        )}

        {risk === "high" && overLimits.length === 0 && (
          <p
            role="note"
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
          >
            <span className="font-semibold uppercase tracking-[0.06em]">
              High risk —{" "}
            </span>
            <span className="text-foreground/90">
              Dispatch will review this packet and may hold the release. Feel
              free to call dispatch to discuss before you continue.
            </span>
          </p>
        )}

        {assessment.mitigations && (
          <div className="rounded-md border border-border bg-background px-3 py-2 text-xs">
            <p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Mitigations applied
            </p>
            <p className="whitespace-pre-wrap text-foreground">
              {assessment.mitigations}
            </p>
          </div>
        )}

        {requiredKind && !hasRequiredAuth && (
          <FratAuthorizationForm
            flightId={flightId}
            kind={requiredKind}
            band={RISK_BAND_CLASSES[risk]}
          />
        )}

        {assessment.authorizations.length > 0 && (
          <ul className="space-y-1.5">
            {assessment.authorizations.map((a) => (
              <li
                key={a.id}
                className="rounded-md border border-status-green/40 bg-status-green/5 px-3 py-2 text-xs"
              >
                <span className="font-semibold uppercase tracking-[0.06em] text-status-green">
                  {a.kind === "dispatch_contact"
                    ? "Dispatch contact"
                    : "CP / DO authorization"}
                </span>{" "}
                — <span className="text-foreground">{a.authorizer_name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  ({a.authorizer_role})
                </span>
                {a.notes && (
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                    {a.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {overLimits.length === 0 && (
        <button
          type="button"
          disabled={!hasRequiredAuth || pending}
          onClick={handleContinue}
          className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:bg-brand-dark disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 5 →"}
        </button>
        )}

        <button
          type="button"
          onClick={onRetake}
          className="w-full text-center text-[0.7rem] font-semibold text-primary hover:underline"
        >
          ↻ Retake questionnaire
        </button>

        {error && (
          <p role="alert" className="text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function FratAuthorizationForm({
  flightId,
  kind,
  band,
}: {
  flightId: string;
  kind: FratAuthorizationKind;
  band: string;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(
    kind === "dispatch_contact" ? "dispatcher" : "chief_pilot",
  );
  const [certNumber, setCertNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && role.trim().length > 0 && !pending;

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordFratAuthorizationAction(flightId, {
        kind,
        authorizer_name: name.trim(),
        authorizer_role: role.trim(),
        authorizer_cert_number:
          certNumber.trim() === "" ? undefined : certNumber.trim(),
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className={cn("space-y-2 rounded-md border px-3 py-3 text-xs", band)}>
      <p className="font-semibold uppercase tracking-[0.06em]">
        {kind === "dispatch_contact"
          ? "Dispatch contact required"
          : "CP / DO authorization required"}
      </p>
      <p className="text-foreground">
        {kind === "dispatch_contact"
          ? "Contact dispatch and record the conversation below."
          : "Record the Chief Pilot or Director of Ops authorization below."}
      </p>
      <Field
        label="Authorizer name"
        value={name}
        onChange={setName}
        placeholder={
          kind === "dispatch_contact" ? "Sarah Dispatcher" : "Dana Chief-Pilot"
        }
      />
      <Field
        label="Role"
        value={role}
        onChange={setRole}
        placeholder={
          kind === "dispatch_contact"
            ? "dispatcher"
            : "chief_pilot or director_of_operations"
        }
      />
      {kind === "cp_do_authorization" && (
        <Field
          label="Certificate number (optional)"
          value={certNumber}
          onChange={setCertNumber}
          placeholder="A&P / ATP cert"
        />
      )}
      <Field
        label="Notes"
        value={notes}
        onChange={setNotes}
        placeholder={
          kind === "dispatch_contact"
            ? "Conversation summary, time, mitigations"
            : "Authorization rationale + conditions briefed"
        }
        multiline
      />
      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:bg-brand-dark disabled:opacity-50"
      >
        {pending ? "Recording…" : "Record authorization"}
      </button>
      {error && (
        <p role="alert" className="text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      )}
    </div>
  );
}

/** The block's expiry, in the same UTC shape the rest of the preflight
 *  uses. Sliced out of the ISO string rather than parsed through Date:
 *  this renders on the server and again in the browser, and a local
 *  format would disagree between the two. */
function formatBlockExpiry(iso: string | null): string {
  if (!iso) return "—";
  return `${iso.slice(11, 16)}Z`;
}

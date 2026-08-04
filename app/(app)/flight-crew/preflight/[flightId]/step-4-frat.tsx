"use client";

import { useMemo, useState, useTransition } from "react";

import type {
  FratAssessmentResponse,
  FratAuthorizationKind,
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
  // Thresholds shifted +5 (Phil, Aug 2026) so the recalibrated bands
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

export function FlightRiskAssessmentStep({ flightId, initial }: Props) {
  // Pilots reach this component in two modes:
  //   1. First-time — no assessment yet, render the questionnaire.
  //   2. Post-submit — assessment exists, render the result + Continue.
  // Phil #6 (Aug 2026) added an Edit link to completed steps in the
  // preflight shell. For FRAT specifically, "editing" means retaking
  // the questionnaire — a new assessment row is written and becomes
  // the latest. The result panel exposes a "Retake questionnaire"
  // link that flips this local override so we re-render the empty
  // questionnaire without needing a route change.
  const [override, setOverride] = useState(false);
  if (!initial || override) {
    return <FratQuestionnaire flightId={flightId} />;
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

function FratQuestionnaire({ flightId }: { flightId: string }) {
  const [answers, setAnswers] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const group of FACTOR_GROUPS)
      for (const f of group.factors) init[f.code] = 0;
    return init;
  });
  const [mitigations, setMitigations] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => Object.values(answers).reduce((sum, v) => sum + v, 0),
    [answers],
  );
  const risk = scoreToRiskLevel(total);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitFratAction(flightId, {
        answers,
        mitigations: mitigations.trim() || undefined,
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
        {FACTOR_GROUPS.map((group) => (
          <div key={group.group}>
            <h3 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-status-blue">
              {group.group}
            </h3>
            <div className="space-y-3">
              {group.factors.map((f) => (
                <FactorRow
                  key={f.code}
                  factor={f}
                  value={answers[f.code]}
                  onChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [f.code]: v }))
                  }
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground focus:border-status-blue focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleSubmit}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Submitting…" : "Submit assessment"}
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

function FactorRow({
  factor,
  value,
  onChange,
}: {
  factor: FratFactor;
  value: number;
  onChange: (v: number) => void;
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
            className="flex-1 accent-status-blue"
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
  // Only EXTREME hard-gates the pilot behind an authorization row.
  // HIGH used to require a `dispatch_contact` gate on this screen —
  // Phil (Aug 2026) removed it: dispatch controls whether the packet
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
            value={
              risk === "extreme"
                ? hasRequiredAuth
                  ? "Cleared"
                  : "Pending"
                : risk === "high"
                  ? "Dispatch reviews"
                  : "Not required"
            }
            valueClass={
              risk === "extreme"
                ? hasRequiredAuth
                  ? "text-status-green text-sm"
                  : "text-status-yellow text-sm"
                : risk === "high"
                  ? "text-status-yellow text-sm"
                  : "text-muted-foreground text-sm"
            }
          />
        </div>

        {risk === "high" && (
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

        <button
          type="button"
          disabled={!hasRequiredAuth || pending}
          onClick={handleContinue}
          className="inline-flex w-full items-center justify-center rounded-md bg-status-blue px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Continue to Step 5 →"}
        </button>

        <button
          type="button"
          onClick={onRetake}
          className="w-full text-center text-[0.7rem] font-semibold text-status-blue hover:underline"
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

  const canSubmit = name.trim().length > 0 && role.trim().length > 0 && !pending;

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
          kind === "dispatch_contact" ? "Sarah Dispatcher" : "Phil Bass"
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
        className="w-full rounded-md bg-status-blue px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:brightness-110 disabled:opacity-50"
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
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
      )}
    </div>
  );
}

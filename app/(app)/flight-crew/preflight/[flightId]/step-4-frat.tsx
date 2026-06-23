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
   *  result + (for HIGH/EXTREME) the authorization sub-form. */
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
 *   - LOW / MEDIUM   — Continue button enables immediately
 *   - HIGH           — must record a `dispatch_contact` auth row first
 *   - EXTREME        — must record a `cp_do_authorization` auth row first
 *
 * Continue calls `completeStepAction(flightId, 4, ...)` once gating is
 * cleared, advancing the preflight to Step 5.
 */

// Catalog mirrors legacy frat_form.html. Adding/removing factors here
// doesn't need a backend change — `answers` is JSONB and the server
// just sums whatever it receives.
const FACTOR_GROUPS: ReadonlyArray<{
  group: string;
  factors: ReadonlyArray<{ code: string; label: string }>;
}> = [
  {
    group: "Pilot Factors",
    factors: [
      { code: "pilot_rest", label: "Rest in last 24h (adequate=0, fatigued=5)" },
      { code: "pilot_currency", label: "Aircraft currency / recent hours (current=0, low=5)" },
      { code: "pilot_duty", label: "Duty day length (fresh=0, near limit=5)" },
      { code: "pilot_health", label: "Health / IMSAFE (fit=0, concerning=5)" },
    ],
  },
  {
    group: "Aircraft Factors",
    factors: [
      { code: "ac_maintenance", label: "Maintenance status (no deferrals=0, MEL items=5)" },
      { code: "ac_performance", label: "Performance margin (ample=0, tight=5)" },
      { code: "ac_equipment", label: "Equipment / avionics readiness (all working=0, degraded=5)" },
    ],
  },
  {
    group: "Environment / Weather",
    factors: [
      { code: "wx_ceiling", label: "Ceiling (>3000 ft=0, near minimums=5)" },
      { code: "wx_vis", label: "Visibility (>6 SM=0, near minimums=5)" },
      { code: "wx_wind", label: "Wind / gusts (calm=0, strong/xwind=5)" },
      { code: "wx_icing", label: "Icing conditions (none=0, severe=5)" },
      { code: "wx_turb", label: "Turbulence forecast (smooth=0, severe=5)" },
    ],
  },
  {
    group: "External Pressures",
    factors: [
      { code: "ext_schedule", label: "Schedule pressure (none=0, tight=5)" },
      { code: "ext_passengers", label: "Passenger expectations / VIPs (none=0, high=5)" },
      { code: "ext_ops", label: "Ops/dispatch pressure (none=0, high=5)" },
    ],
  },
  {
    group: "Route / Terrain",
    factors: [
      { code: "route_terrain", label: "Terrain challenge (flat=0, mountainous=5)" },
      { code: "route_remote", label: "Remoteness / search & rescue access (close=0, remote=5)" },
      { code: "route_airport", label: "Destination airport challenge (paved=0, gravel/short=5)" },
    ],
  },
];

function scoreToRiskLevel(score: number): FratRiskLevel {
  if (score < 10) return "low";
  if (score < 20) return "medium";
  if (score < 30) return "high";
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
  return initial ? (
    <FratResultPanel flightId={flightId} assessment={initial} />
  ) : (
    <FratQuestionnaire flightId={flightId} />
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
          Score each factor 0–5. Total determines risk level: LOW &lt;10 ·
          MEDIUM 10–19 · HIGH 20–29 · EXTREME 30+.
        </p>
      </header>

      <div className="space-y-4 px-5 py-4 text-sm">
        {FACTOR_GROUPS.map((group) => (
          <div key={group.group}>
            <h3 className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-status-blue">
              {group.group}
            </h3>
            <div className="space-y-2">
              {group.factors.map((f) => (
                <FactorRow
                  key={f.code}
                  code={f.code}
                  label={f.label}
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
  code,
  label,
  value,
  onChange,
}: {
  code: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      <label
        htmlFor={`factor-${code}`}
        className="col-span-8 text-xs text-foreground"
      >
        {label}
      </label>
      <div className="col-span-4 flex items-center gap-2">
        <input
          id={`factor-${code}`}
          type="range"
          min={0}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-status-blue"
        />
        <span className="w-4 text-right font-mono text-sm font-bold text-foreground">
          {value}
        </span>
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
}: {
  flightId: string;
  assessment: FratAssessmentResponse;
}) {
  const risk = assessment.risk_level;
  const requiredKind: FratAuthorizationKind | null =
    risk === "high"
      ? "dispatch_contact"
      : risk === "extreme"
        ? "cp_do_authorization"
        : null;
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
              requiredKind === null
                ? "Not required"
                : hasRequiredAuth
                  ? "Cleared"
                  : "Pending"
            }
            valueClass={
              hasRequiredAuth
                ? "text-status-green text-sm"
                : "text-status-yellow text-sm"
            }
          />
        </div>

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

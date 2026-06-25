"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { FlightLogLeg, FlightLogLegUpdateRequest } from "@/lib/api/types";

import { updateLegAction } from "./legs-actions";

/**
 * Editable W&B card for one leg — Spec 4 §"7-tab Electronic Flight
 * Log / Tab 3: Weight & Balance". Layout mirrors the legacy
 * `templates/elog/log_page.html` Tab 3:
 *
 *   Header:  "Leg N W&B: ORIG → DEST" + Ramp Wt total
 *   Inputs:  BEW · Pilot · SIC · PAX · Baggage · Cargo · Fuel gal · Fuel wt
 *   Hints:   Takeoff / Landing weight + CG show as "Needs aircraft
 *            config" until per-aircraft moment-arm data lands in M3
 *
 * Save model identical to Tab 2 LegCard: each input keeps local
 * state, blur diffs vs original, PATCH only changed keys via the
 * shared `updateLegAction` server-action wrapper.
 *
 * Read-only mode disables every input. No Add Leg / Delete buttons
 * here — those live on Tab 2.
 */
export function WeightBalanceCard({
  logId,
  leg,
  readOnly,
}: {
  logId: string;
  leg: FlightLogLeg;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<WbState>(toWbState(leg));

  function patch<K extends keyof WbState>(key: K, value: WbState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function commit(key: keyof WbState) {
    const original = toWbState(leg)[key];
    const next = state[key];
    if (Object.is(original, next)) return;

    const payload = {
      [key]: toApiValue(next),
    } as FlightLogLegUpdateRequest;
    startTransition(async () => {
      setError(null);
      const result = await updateLegAction(logId, leg.id, payload);
      if (result.status === "error") {
        setError(result.message);
        setState((prev) => ({ ...prev, [key]: original }));
        return;
      }
      router.refresh();
    });
  }

  const rampWeight = computeRampWeight(state);

  const routeLabel = formatRoute(leg.origin_icao, leg.dest_icao);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-status-blue">
            Leg {leg.leg_number} W&amp;B
          </span>
          <span className="text-[0.65rem] font-mono text-muted-foreground">
            {routeLabel}
          </span>
        </div>
        <div className="text-[0.65rem] text-muted-foreground">
          Ramp Weight{" "}
          <span className="font-bold text-status-green">
            {rampWeight !== null ? rampWeight.toFixed(0) : "—"}
          </span>{" "}
          lbs
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <NumberField
          label="Basic Empty Weight"
          value={state.basic_empty_weight_lbs}
          onChange={(v) => patch("basic_empty_weight_lbs", v)}
          onBlur={() => commit("basic_empty_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Pilot"
          value={state.pilot_weight_lbs}
          onChange={(v) => patch("pilot_weight_lbs", v)}
          onBlur={() => commit("pilot_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="SIC"
          value={state.sic_weight_lbs}
          onChange={(v) => patch("sic_weight_lbs", v)}
          onBlur={() => commit("sic_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="PAX (total)"
          value={state.pax_weight_lbs}
          onChange={(v) => patch("pax_weight_lbs", v)}
          onBlur={() => commit("pax_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Baggage"
          value={state.baggage_weight_lbs}
          onChange={(v) => patch("baggage_weight_lbs", v)}
          onBlur={() => commit("baggage_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Cargo"
          value={state.cargo_weight_lbs}
          onChange={(v) => patch("cargo_weight_lbs", v)}
          onBlur={() => commit("cargo_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Fuel Gallons"
          value={state.fuel_gallons}
          onChange={(v) => patch("fuel_gallons", v)}
          onBlur={() => commit("fuel_gallons")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Fuel Weight"
          value={state.fuel_weight_lbs}
          onChange={(v) => patch("fuel_weight_lbs", v)}
          onBlur={() => commit("fuel_weight_lbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-md bg-muted/20 p-2 text-center text-[0.65rem]">
        <Derived
          label="Takeoff Wt"
          hint="Needs aircraft config (M3)"
        />
        <Derived
          label="Landing Wt"
          hint="Needs aircraft config (M3)"
        />
        <Derived
          label="CG"
          hint="Needs aircraft config (M3)"
        />
      </div>

      {pending && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
          <Spinner size="xs" /> Saving…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

// ---------- Local field types + helpers ----------

interface WbState {
  basic_empty_weight_lbs: string;
  pilot_weight_lbs: string;
  sic_weight_lbs: string;
  pax_weight_lbs: string;
  baggage_weight_lbs: string;
  cargo_weight_lbs: string;
  fuel_gallons: string;
  fuel_weight_lbs: string;
}

function toWbState(leg: FlightLogLeg): WbState {
  return {
    basic_empty_weight_lbs: numberToInput(leg.basic_empty_weight_lbs),
    pilot_weight_lbs: numberToInput(leg.pilot_weight_lbs),
    sic_weight_lbs: numberToInput(leg.sic_weight_lbs),
    pax_weight_lbs: numberToInput(leg.pax_weight_lbs),
    baggage_weight_lbs: numberToInput(leg.baggage_weight_lbs),
    cargo_weight_lbs: numberToInput(leg.cargo_weight_lbs),
    fuel_gallons: numberToInput(leg.fuel_gallons),
    fuel_weight_lbs: numberToInput(leg.fuel_weight_lbs),
  };
}

function numberToInput(value: number | null): string {
  return value === null ? "" : value.toString();
}

function toApiValue(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function computeRampWeight(state: WbState): number | null {
  // Ramp weight = BEW + every other weight column (the seven inputs
  // that all carry pounds). Fuel weight is in pounds; fuel_gallons
  // is informational, not a load weight, so we exclude it. If BEW is
  // missing the total isn't meaningful — return null so the UI shows
  // a dash instead of misleading a pilot.
  if (state.basic_empty_weight_lbs.trim() === "") return null;
  const fields: (keyof WbState)[] = [
    "basic_empty_weight_lbs",
    "pilot_weight_lbs",
    "sic_weight_lbs",
    "pax_weight_lbs",
    "baggage_weight_lbs",
    "cargo_weight_lbs",
    "fuel_weight_lbs",
  ];
  let total = 0;
  for (const key of fields) {
    const v = Number(state[key]);
    if (Number.isFinite(v)) total += v;
  }
  return Math.round(total);
}

function formatRoute(
  origin: string | null,
  dest: string | null,
): string {
  return `${origin ?? "?"} → ${dest ?? "?"}`;
}

// ---------- Field primitives ----------

let nextFieldId = 0;
function useFieldId(label: string): string {
  // Stable per-mount id without pulling in useId — the slug from
  // the label plus a per-instance counter is plenty for the small
  // number of fields a W&B card renders.
  return `wb-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${++nextFieldId}`;
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
  step = 1,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  step?: number;
  disabled?: boolean;
}) {
  const id = useFieldId(label);
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        step={step}
        min={0}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
}

function Derived({ label, hint }: { label: string; hint: string }) {
  return (
    <div>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div className="text-[0.65rem] italic text-muted-foreground/70">
        {hint}
      </div>
    </div>
  );
}

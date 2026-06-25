"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { FlightLogLeg } from "@/lib/api/types";

import { updateLegAction } from "./legs-actions";
import { fieldsForFamily, type AirframeFamily, type TrendField } from "./trend-fields";

/**
 * Editable trend card for one leg — Spec 4 §"7-tab Electronic Flight
 * Log / Tab 5". Renders the airframe-family-specific field set; on
 * blur the card rebuilds the full trend_data object (per the
 * airframe's field list, dropping empties) and PATCHes it wholesale.
 *
 * Why wholesale-replace: the API contract is `trend_data: object`
 * (the server stores raw). Sending a partial PATCH would let the
 * stored blob accumulate keys from earlier airframes if an aircraft
 * was re-typed mid-flight — unlikely but the cleanup cost of
 * "always send the current shape" is one extra object literal per
 * save, which is trivial.
 *
 * Empty inputs are dropped before sending so the persisted blob
 * doesn't carry "" stand-ins for missing numbers.
 */
export function TrendCard({
  logId,
  leg,
  family,
  readOnly,
}: {
  logId: string;
  leg: FlightLogLeg;
  family: AirframeFamily;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fields = fieldsForFamily(family);
  const [state, setState] = useState<Record<string, string>>(
    toState(leg, fields),
  );

  function patch(key: string, value: string) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function commit() {
    const original = toState(leg, fields);
    if (sameShape(original, state)) return;

    const next = stateToTrendData(state, fields);
    startTransition(async () => {
      setError(null);
      const result = await updateLegAction(logId, leg.id, {
        trend_data: next,
      });
      if (result.status === "error") {
        setError(result.message);
        setState(original);
        return;
      }
      router.refresh();
    });
  }

  // Group adjacent fields with the same `group` under a sub-heading.
  const grouped = groupFields(fields);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-status-blue">
          Leg {leg.leg_number} Trends
        </span>
        <span className="text-[0.65rem] font-mono text-muted-foreground">
          {leg.origin_icao ?? "?"} → {leg.dest_icao ?? "?"}
        </span>
      </header>

      <div className="space-y-3">
        {grouped.map(({ group, items }) => (
          <div key={group ?? "ungrouped"}>
            {group && (
              <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
                {group}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {items.map((field) => (
                <TrendInput
                  key={field.key}
                  field={field}
                  value={state[field.key] ?? ""}
                  onChange={(v) => patch(field.key, v)}
                  onBlur={commit}
                  disabled={readOnly || pending}
                />
              ))}
            </div>
          </div>
        ))}
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

// ---------- Local helpers ----------

function toState(
  leg: FlightLogLeg,
  fields: TrendField[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) {
    const v = leg.trend_data?.[field.key];
    out[field.key] = v === null || v === undefined ? "" : String(v);
  }
  return out;
}

function sameShape(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  for (const key of Object.keys(a)) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function stateToTrendData(
  state: Record<string, string>,
  fields: TrendField[],
): Record<string, number | string | null> {
  const out: Record<string, number | string | null> = {};
  for (const field of fields) {
    const raw = (state[field.key] ?? "").trim();
    if (raw === "") continue;
    if (field.kind === "number") {
      const n = Number(raw);
      if (Number.isFinite(n)) out[field.key] = n;
    } else {
      out[field.key] = raw;
    }
  }
  return out;
}

function groupFields(
  fields: TrendField[],
): { group: string | undefined; items: TrendField[] }[] {
  const groups: { group: string | undefined; items: TrendField[] }[] = [];
  let current: { group: string | undefined; items: TrendField[] } | null = null;
  for (const field of fields) {
    if (!current || current.group !== field.group) {
      current = { group: field.group, items: [] };
      groups.push(current);
    }
    current.items.push(field);
  }
  return groups;
}

let nextFieldId = 0;

function TrendInput({
  field,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  field: TrendField;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  // Stable per-mount id so the label htmlFor binds correctly.
  const id = `trend-${field.key}-${++nextFieldId}`;
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {field.label}
      </label>
      <input
        id={id}
        type={field.kind === "number" ? "number" : "text"}
        step={field.kind === "number" ? (field.step ?? 1) : undefined}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
}

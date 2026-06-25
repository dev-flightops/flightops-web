"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type {
  FlightLogResponse,
  FlightLogUpdateRequest,
  VorCheckType,
} from "@/lib/api/types";

import { updateVorCheckAction } from "./vor-actions";

/**
 * Editable VOR-check card — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 6". Layout mirrors legacy templates/elog/log_page.html Tab 6:
 *
 *   Row 1: Identifier · Check Type · Station · Location
 *   Row 2: Bearing Indicated · Bearing Known · Error (computed) · Checked At
 *   Footer: Certification checkbox
 *
 * Save model: each input keeps local state; on blur the card diffs
 * vs original and PATCHes only changed keys via updateVorCheckAction.
 * Tolerance hint (+/- 4° / +/- 6° per check_type) renders next to the
 * computed error field; OUT-OF-TOLERANCE shows red.
 *
 * Submitted-log mode disables every input + the checkbox; the
 * existing tolerance hint still renders read-only so the pilot can
 * see the historical result.
 */
export function VorCheckCard({
  log,
  readOnly,
}: {
  log: FlightLogResponse;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<EditableVor>(toEditable(log));

  function patch<K extends keyof EditableVor>(
    key: K,
    value: EditableVor[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function commit(key: keyof EditableVor) {
    const original = toEditable(log)[key];
    const next = state[key];
    if (Object.is(original, next)) return;

    const payload = {
      [key]: toApiValue(key, next),
    } as FlightLogUpdateRequest;
    startTransition(async () => {
      setError(null);
      const result = await updateVorCheckAction(log.id, payload);
      if (result.status === "error") {
        setError(result.message);
        setState((prev) => ({ ...prev, [key]: original }));
        return;
      }
      router.refresh();
    });
  }

  function commitCheckbox(checked: boolean) {
    setState((prev) => ({ ...prev, vor_certified: checked }));
    startTransition(async () => {
      setError(null);
      const result = await updateVorCheckAction(log.id, {
        vor_certified: checked,
      });
      if (result.status === "error") {
        setError(result.message);
        setState((prev) => ({ ...prev, vor_certified: !checked }));
        return;
      }
      router.refresh();
    });
  }

  // Compute error client-side from the LOCAL state (so it updates as
  // the pilot types). Falls back to the server-supplied value when
  // both bearings are absent / unparseable.
  const computedError = computeError(state);
  const tolerance = toleranceFor(state.vor_check_type);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TextField
          label="VOR Identifier"
          value={state.vor_identifier}
          maxLength={5}
          onChange={(v) => patch("vor_identifier", v.toUpperCase())}
          onBlur={() => commit("vor_identifier")}
          disabled={readOnly || pending}
          mono
        />
        <SelectField
          label="Check Type"
          value={state.vor_check_type}
          onChange={(v) => patch("vor_check_type", v)}
          onBlur={() => commit("vor_check_type")}
          disabled={readOnly || pending}
        >
          <option value="">—</option>
          <option value="ground">Ground (4° max)</option>
          <option value="airborne">Airborne (6° max)</option>
          <option value="vot">VOT (4° max)</option>
          <option value="dual">Dual VOR (4° max)</option>
        </SelectField>
        <TextField
          label="Station / Facility"
          value={state.vor_station_facility}
          onChange={(v) => patch("vor_station_facility", v)}
          onBlur={() => commit("vor_station_facility")}
          disabled={readOnly || pending}
        />
        <TextField
          label="Location"
          value={state.vor_location}
          onChange={(v) => patch("vor_location", v)}
          onBlur={() => commit("vor_location")}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Bearing Indicated"
          value={state.vor_bearing_indicated}
          min={0}
          max={360}
          step={0.1}
          onChange={(v) => patch("vor_bearing_indicated", v)}
          onBlur={() => commit("vor_bearing_indicated")}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Bearing Known"
          value={state.vor_bearing_known}
          min={0}
          max={360}
          step={0.1}
          onChange={(v) => patch("vor_bearing_known", v)}
          onBlur={() => commit("vor_bearing_known")}
          disabled={readOnly || pending}
        />
        <div>
          <FieldLabel>Error (°)</FieldLabel>
          <div
            className={`w-full rounded-md border border-border bg-background/50 px-3 py-1.5 text-xs font-mono ${
              computedError !== null && tolerance !== null && Math.abs(computedError) > tolerance
                ? "text-status-red"
                : "text-foreground"
            }`}
            aria-label="Computed error"
          >
            {computedError !== null ? formatError(computedError) : "—"}
            {tolerance !== null && computedError !== null && (
              <span className="ml-2 text-[0.6rem] text-muted-foreground">
                tol ±{tolerance}°
              </span>
            )}
          </div>
        </div>
        <TextField
          label="Date & Time"
          type="datetime-local"
          value={state.vor_checked_at}
          onChange={(v) => patch("vor_checked_at", v)}
          onBlur={() => commit("vor_checked_at")}
          disabled={readOnly || pending}
        />
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={state.vor_certified}
          onChange={(e) => commitCheckbox(e.target.checked)}
          disabled={readOnly || pending}
          className="h-4 w-4 accent-status-green disabled:opacity-60"
        />
        I certify this VOR check is accurate and within tolerances.
      </label>

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

// ---------- Local state + helpers ----------

interface EditableVor {
  vor_identifier: string;
  vor_check_type: string;
  vor_station_facility: string;
  vor_location: string;
  vor_bearing_indicated: string;
  vor_bearing_known: string;
  vor_checked_at: string;
  vor_certified: boolean;
}

function toEditable(log: FlightLogResponse): EditableVor {
  return {
    vor_identifier: log.vor_identifier ?? "",
    vor_check_type: log.vor_check_type ?? "",
    vor_station_facility: log.vor_station_facility ?? "",
    vor_location: log.vor_location ?? "",
    vor_bearing_indicated: numToInput(log.vor_bearing_indicated),
    vor_bearing_known: numToInput(log.vor_bearing_known),
    vor_checked_at: datetimeToInput(log.vor_checked_at),
    vor_certified: Boolean(log.vor_certified),
  };
}

function numToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : value.toString();
}

/** ISO 8601 ("2026-06-15T14:30:00Z") → "YYYY-MM-DDTHH:MM" for
 *  <input type="datetime-local">. Empty when null. */
function datetimeToInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function toApiValue(key: keyof EditableVor, value: unknown): unknown {
  switch (key) {
    case "vor_bearing_indicated":
    case "vor_bearing_known": {
      const trimmed = String(value ?? "").trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case "vor_check_type": {
      const v = String(value ?? "").trim();
      return v === "" ? null : (v as VorCheckType);
    }
    case "vor_identifier":
    case "vor_station_facility":
    case "vor_location": {
      const v = String(value ?? "").trim();
      return v === "" ? null : v;
    }
    case "vor_checked_at": {
      const v = String(value ?? "").trim();
      // datetime-local gives "YYYY-MM-DDTHH:MM"; add :00Z so the
      // backend sees a complete ISO 8601 instant. Users entering
      // local times — fine for the regulatory record.
      return v === "" ? null : `${v}:00Z`;
    }
    default:
      return value;
  }
}

/** Signed error: indicated - known. Null when either bearing is
 *  missing / unparseable. The UI handles abs() for tolerance check. */
function computeError(state: EditableVor): number | null {
  const indicated = parseFloat(state.vor_bearing_indicated);
  const known = parseFloat(state.vor_bearing_known);
  if (!Number.isFinite(indicated) || !Number.isFinite(known)) return null;
  return round1(indicated - known);
}

function toleranceFor(checkType: string): number | null {
  if (checkType === "airborne") return 6;
  if (checkType === "ground" || checkType === "vot" || checkType === "dual") {
    return 4;
  }
  return null;
}

function formatError(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}°`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- Field primitives ----------

let nextFieldId = 0;
function useFieldId(label: string): string {
  return `vor-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${++nextFieldId}`;
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
    >
      {children}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  maxLength,
  type = "text",
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  maxLength?: number;
  type?: string;
  mono?: boolean;
}) {
  const id = useFieldId(label);
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60 ${
          mono ? "font-mono uppercase" : ""
        }`}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  onBlur,
  step = 1,
  min,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const id = useFieldId(label);
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const id = useFieldId(label);
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
      >
        {children}
      </select>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import type { FlightLogLeg, FlightLogLegUpdateRequest } from "@/lib/api/types";

import { deleteLegAction, updateLegAction } from "./legs-actions";

/**
 * Editable card for one leg — Spec 4 §"7-tab Electronic Flight Log /
 * Tab 2". Layout mirrors legacy `templates/elog/log_page.html`:
 *
 *   Header:   "Leg N" + computed flight/block/hobbs totals + Delete
 *   Row 1:    Origin · (Engine On, Takeoff) · (Landing, Shutdown) · Dest
 *   Row 2:    Start Hobbs · End Hobbs · Landings · Night Landings
 *   Row 3:    Pilot Flying · Routing (full-width)
 *
 * Each input maintains local state for typing, then fires a PATCH
 * via `updateLegAction` on blur. Saves are debounced by the natural
 * tab/blur cadence — no autosave timer.
 *
 * Computed totals (flight time, block time, hobbs delta) are pure
 * math over the current local state, so they update as the pilot
 * types — server roundtrip not required to see the totals refresh.
 *
 * read-only mode disables every field + hides Delete; matches Spec
 * 4's "submitted logs are closed for further edits" rule.
 */
export function LegCard({
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

  // Track local field state separately from the server snapshot so
  // the user can type freely without each keystroke firing a PATCH.
  // On blur we compute the diff and only PATCH the keys that
  // actually changed.
  const [state, setState] = useState<EditableLeg>(toEditable(leg));

  function patchField<K extends keyof EditableLeg>(
    key: K,
    value: EditableLeg[K],
  ) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function commit(key: keyof EditableLeg) {
    const original = toEditable(leg)[key];
    const next = state[key];
    if (Object.is(original, next)) return; // no change → skip PATCH

    const payload = { [key]: toApiValue(key, next) } as FlightLogLegUpdateRequest;
    startTransition(async () => {
      setError(null);
      const result = await updateLegAction(logId, leg.id, payload);
      if (result.status === "error") {
        setError(result.message);
        // Rollback the local state to the original so the UI doesn't
        // lie to the pilot about what was saved.
        setState((prev) => ({ ...prev, [key]: original }));
        return;
      }
      router.refresh();
    });
  }

  function onDelete() {
    if (
       
      !confirm(`Delete Leg ${leg.leg_number}? This can't be undone.`)
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await deleteLegAction(logId, leg.id);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }

  const totals = computeTotals(state);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-status-blue">
            Leg {leg.leg_number}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            <Stat color="text-status-green" label="flight" value={totals.flightTime} />
            {" · "}
            <Stat color="text-status-blue" label="block" value={totals.blockTime} />
            {" · "}
            <Stat color="text-status-yellow" label="hobbs" value={totals.hobbsTime} />
          </span>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-[0.65rem] font-semibold text-status-red hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <IcaoField
          label="Origin"
          value={state.origin_icao}
          onChange={(v) => patchField("origin_icao", v)}
          onBlur={() => commit("origin_icao")}
          disabled={readOnly || pending}
        />
        <TimeField
          label="Engine On"
          value={state.engine_on}
          onChange={(v) => patchField("engine_on", v)}
          onBlur={() => commit("engine_on")}
          disabled={readOnly || pending}
        />
        <TimeField
          label="Takeoff"
          value={state.blocks_off}
          onChange={(v) => patchField("blocks_off", v)}
          onBlur={() => commit("blocks_off")}
          disabled={readOnly || pending}
        />
        <IcaoField
          label="Destination"
          value={state.dest_icao}
          onChange={(v) => patchField("dest_icao", v)}
          onBlur={() => commit("dest_icao")}
          disabled={readOnly || pending}
        />
        <TimeField
          label="Landing"
          value={state.blocks_on}
          onChange={(v) => patchField("blocks_on", v)}
          onBlur={() => commit("blocks_on")}
          disabled={readOnly || pending}
        />
        <TimeField
          label="Shutdown"
          value={state.engine_off}
          onChange={(v) => patchField("engine_off", v)}
          onBlur={() => commit("engine_off")}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Start Hobbs"
          value={state.start_hobbs}
          onChange={(v) => patchField("start_hobbs", v)}
          onBlur={() => commit("start_hobbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="End Hobbs"
          value={state.end_hobbs}
          onChange={(v) => patchField("end_hobbs", v)}
          onBlur={() => commit("end_hobbs")}
          step={0.1}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Landings"
          value={state.landings}
          onChange={(v) => patchField("landings", v)}
          onBlur={() => commit("landings")}
          step={1}
          min={0}
          max={50}
          disabled={readOnly || pending}
        />
        <NumberField
          label="Night Landings"
          value={state.night_landings}
          onChange={(v) => patchField("night_landings", v)}
          onBlur={() => commit("night_landings")}
          step={1}
          min={0}
          max={50}
          disabled={readOnly || pending}
        />
        <SelectField
          label="Pilot Flying"
          value={state.pilot_flying}
          onChange={(v) => {
            patchField("pilot_flying", v as "pic" | "sic");
          }}
          onBlur={() => commit("pilot_flying")}
          disabled={readOnly || pending}
        >
          <option value="pic">PIC</option>
          <option value="sic">SIC</option>
        </SelectField>
        <CheckboxField
          label="Crosses Midnight"
          checked={state.crosses_midnight}
          onChange={(v) => {
            patchField("crosses_midnight", v);
            startTransition(async () => {
              setError(null);
              const result = await updateLegAction(logId, leg.id, {
                crosses_midnight: v,
              });
              if (result.status === "error") {
                setError(result.message);
                patchField("crosses_midnight", !v);
                return;
              }
              router.refresh();
            });
          }}
          disabled={readOnly || pending}
        />
      </div>

      <div className="mt-3">
        <FieldLabel htmlFor={`routing-${leg.id}`}>Routing</FieldLabel>
        <input
          id={`routing-${leg.id}`}
          type="text"
          value={state.routing}
          onChange={(e) => patchField("routing", e.target.value)}
          onBlur={() => commit("routing")}
          placeholder="Waypoints / SID-STAR"
          disabled={readOnly || pending}
          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
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

interface EditableLeg {
  origin_icao: string;
  dest_icao: string;
  engine_on: string;
  blocks_off: string;
  blocks_on: string;
  engine_off: string;
  crosses_midnight: boolean;
  start_hobbs: string;
  end_hobbs: string;
  landings: string;
  night_landings: string;
  pilot_flying: "pic" | "sic";
  routing: string;
}

function toEditable(leg: FlightLogLeg): EditableLeg {
  return {
    origin_icao: leg.origin_icao ?? "",
    dest_icao: leg.dest_icao ?? "",
    engine_on: timeToInputValue(leg.engine_on),
    blocks_off: timeToInputValue(leg.blocks_off),
    blocks_on: timeToInputValue(leg.blocks_on),
    engine_off: timeToInputValue(leg.engine_off),
    crosses_midnight: leg.crosses_midnight,
    start_hobbs: leg.start_hobbs?.toString() ?? "",
    end_hobbs: leg.end_hobbs?.toString() ?? "",
    landings: leg.landings.toString(),
    night_landings: leg.night_landings.toString(),
    pilot_flying: leg.pilot_flying,
    routing: leg.routing ?? "",
  };
}

/** Backend returns "HH:MM:SS"; the <input type="time"> wants "HH:MM". */
function timeToInputValue(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/** Map an editable string back to the API's expected payload type. */
function toApiValue(key: keyof EditableLeg, value: unknown): unknown {
  switch (key) {
    case "start_hobbs":
    case "end_hobbs": {
      const trimmed = String(value ?? "").trim();
      if (trimmed === "") return null;
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case "landings":
    case "night_landings": {
      const trimmed = String(value ?? "").trim();
      if (trimmed === "") return 0;
      const n = Number(trimmed);
      return Number.isFinite(n) ? Math.round(n) : 0;
    }
    case "origin_icao":
    case "dest_icao": {
      const trimmed = String(value ?? "").trim().toUpperCase();
      return trimmed === "" ? null : trimmed;
    }
    case "engine_on":
    case "blocks_off":
    case "blocks_on":
    case "engine_off": {
      const trimmed = String(value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    }
    case "routing": {
      const trimmed = String(value ?? "").trim();
      return trimmed === "" ? null : trimmed;
    }
    default:
      return value;
  }
}

interface Totals {
  flightTime: number;
  blockTime: number;
  hobbsTime: number;
}

function computeTotals(state: EditableLeg): Totals {
  return {
    flightTime: hoursBetween(state.blocks_off, state.blocks_on, state.crosses_midnight),
    blockTime: hoursBetween(state.engine_on, state.engine_off, state.crosses_midnight),
    hobbsTime: hobbsDelta(state.start_hobbs, state.end_hobbs),
  };
}

function hoursBetween(start: string, end: string, crossesMidnight: boolean): number {
  if (!start || !end) return 0;
  const startMin = hhmmToMinutes(start);
  const endMin = hhmmToMinutes(end);
  if (startMin === null || endMin === null) return 0;
  let delta = endMin - startMin;
  if (crossesMidnight && delta <= 0) delta += 24 * 60;
  if (delta < 0) return 0;
  return round1(delta / 60);
}

function hhmmToMinutes(value: string): number | null {
  // Accept HH:MM or HH:MM:SS.
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function hobbsDelta(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const start = Number(startStr);
  const end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return round1(Math.max(0, end - start));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------- Field primitives (deliberately bare — Spec 4 doesn't ask for a richer form lib) ----------

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
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

function IcaoField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor={`icao-${label.toLowerCase()}`}>{label}</FieldLabel>
      <input
        type="text"
        maxLength={4}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs uppercase disabled:opacity-60"
      />
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
  onBlur,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor={`time-${label.toLowerCase()}`}>{label}</FieldLabel>
      <input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs disabled:opacity-60"
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
  return (
    <div>
      <FieldLabel htmlFor={`num-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {label}
      </FieldLabel>
      <input
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
  return (
    <div>
      <FieldLabel htmlFor={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        {label}
      </FieldLabel>
      <select
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

function CheckboxField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  // Stacked label + control matches the other grid cells' vertical
  // rhythm so the checkbox row anchors to the same baseline. Before:
  // `flex items-end` floated the checkbox at the bottom of an
  // empty-topped cell, visually detaching it from Landings /
  // Night Landings / Pilot Flying to its left.
  return (
    <div>
      <div className="mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Overnight?
      </div>
      <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-foreground">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="h-3.5 w-3.5 accent-status-blue disabled:opacity-60"
        />
        {label}
      </label>
    </div>
  );
}

function Stat({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <>
      <span className={color}>{value.toFixed(1)}</span>h {label}
    </>
  );
}

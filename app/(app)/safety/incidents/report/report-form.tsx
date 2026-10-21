"use client";

import { useActionState, useState } from "react";

import {
  HAZARD_SEVERITIES,
  HAZARD_SEVERITY_LABELS,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
} from "@/lib/api/safety";
import type { StationListItem } from "@/lib/api/types";
import {
  localToUtcIso,
  utcToLocalInput,
  type ZoneTable,
  zoneAbbreviation,
  zoneFor,
  zuluHint,
} from "@/lib/format/local-time";

import {
  type IncidentReportFormState,
  submitIncidentAction,
} from "./actions";

const _initialState: IncidentReportFormState = { status: "idle" };

export function IncidentReportForm({
  stations,
  zones,
  now,
}: {
  stations: StationListItem[];
  /** Each base's zone: the time is typed local to the station (#72). */
  zones: ZoneTable;
  /** The page's "now", so the server and the browser start the time
   *  field on the same minute. */
  now: string;
}) {
  const [state, formAction, pending] = useActionState(
    submitIncidentAction,
    _initialState,
  );

  // The time is local to the station, or to the company's base when
  // there is none, and the Zulu it is saved as shows under it. Both are
  // controlled, so a refused submit keeps what was typed.
  const [stationId, setStationId] = useState("");
  const stationIcao = stations.find((s) => s.id === stationId)?.icao_code ?? "";
  const timeZone = zoneFor(zones, stationIcao);
  const [occurredAt, setOccurredAt] = useState(() =>
    utcToLocalInput(now, zoneFor(zones, "")),
  );
  const occurredIso = localToUtcIso(occurredAt, timeZone);
  const tz = zoneAbbreviation(timeZone, new Date(occurredIso ?? now));

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="notice notice-red"
        >
          {state.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Category" name="category" error={state.fieldErrors?.category}>
          <select id="category" name="category" required className="ff-input" defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {INCIDENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {INCIDENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Severity" name="severity" error={state.fieldErrors?.severity}>
          <select id="severity" name="severity" required className="ff-input" defaultValue="medium">
            {HAZARD_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {HAZARD_SEVERITY_LABELS[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label={`When did this happen? (${tz})`}
        name="occurred_at_local"
        error={state.fieldErrors?.occurred_at_local}
        hint={[
          zuluHint(occurredAt, timeZone),
          "Local time at the station, or at the company's base with no station.",
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <input
          id="occurred_at_local"
          name="occurred_at_local"
          type="datetime-local"
          required
          value={occurredAt}
          onChange={(e) => setOccurredAt(e.target.value)}
          className="ff-input"
        />
      </Field>

      <Field
        label="Description"
        name="description"
        error={state.fieldErrors?.description}
        hint="What happened? Include enough detail for triage — root cause + timeline if you have it."
      >
        <textarea
          id="description"
          name="description"
          rows={5}
          required
          minLength={10}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Injuries"
          name="injury_summary"
          error={state.fieldErrors?.injury_summary}
          hint="Write “none” if there were no injuries."
        >
          <textarea
            id="injury_summary"
            name="injury_summary"
            rows={2}
            required
            maxLength={4000}
            className="ff-input"
          />
        </Field>
        <Field
          label="Damage"
          name="damage_summary"
          error={state.fieldErrors?.damage_summary}
          hint="Write “none” if there was no damage."
        >
          <textarea
            id="damage_summary"
            name="damage_summary"
            rows={2}
            required
            maxLength={4000}
            className="ff-input"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Station"
          name="station_id"
          hint="Optional — leave blank for off-airport events."
        >
          <select
            id="station_id"
            name="station_id"
            className="ff-input"
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
          >
            <option value="">— None —</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.icao_code} — {s.name}
              </option>
            ))}
          </select>
          <input type="hidden" name="station_icao" value={stationIcao} />
        </Field>
        <Field
          label="Location (free text)"
          name="location_free_text"
          hint="Only if no station applies."
        >
          <input
            id="location_free_text"
            name="location_free_text"
            type="text"
            maxLength={200}
            className="ff-input"
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        label="Immediate action taken"
        name="immediate_action_taken"
        hint="Optional — what did you do at the time?"
      >
        <textarea
          id="immediate_action_taken"
          name="immediate_action_taken"
          rows={3}
          maxLength={4000}
          className="ff-input"
        />
      </Field>

      <label className="flex items-start gap-2 rounded-md border border-border px-3 py-2.5">
        <input type="checkbox" name="is_anonymous" className="mt-0.5" />
        <span className="text-xs text-foreground/80">
          <span className="font-semibold">Hide my name from the triage inbox.</span>{" "}
          Your identity is still recorded for audit but is only visible
          to the Safety Officer.
        </span>
      </label>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Filing…" : "File Incident"}
        </button>
      </div>

    </form>
  );
}

function Field({
  label,
  name,
  hint,
  error,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="field-label"
      >
        {label}
      </label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-[0.6875rem] text-muted-foreground">{hint}</p>
      ) : null}
      {error ? (
        <p className="field-error">{error}</p>
      ) : null}
    </div>
  );
}

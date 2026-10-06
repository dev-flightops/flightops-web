"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { saveRiskInputsAction } from "@/app/(app)/dispatch/risk-actions";
import type {
  AreaForecastRegion,
  AutoAnswer,
  DispatchRisk,
  DispatchRiskInputsPatch,
} from "@/lib/api/dispatch-risk";

import { SectionPanel } from "./section-panel";

/**
 * The dispatcher's side of the risk matrix (#50): the legacy packet form's
 * Compliance Gates, Company Risk Inputs, Management Approval Triggers and
 * notes, now live. Most answers are worked out from our data and shown as
 * "Auto"; the dispatcher can override any of them, and answers the rest.
 * Each change saves at once and the page re-scores the flight.
 */

const LABEL =
  "mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

type Props = { flightId: string; risk: DispatchRisk; canEdit: boolean };

function useRiskSave(flightId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function save(patch: DispatchRiskInputsPatch) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveRiskInputsAction(flightId, patch);
        if (result.ok) router.refresh();
        else setError(result.error);
      } catch {
        setError("Couldn't reach the server. Check the connection and try again.");
      }
    });
  }
  return { save, pending, error };
}

function SaveState({ pending, error }: { pending: boolean; error: string | null }) {
  if (error) {
    return (
      <p role="alert" className="mt-2 text-[0.7rem] text-status-red">
        {error}
      </p>
    );
  }
  return pending ? (
    <p role="status" className="mt-2 text-[0.7rem] text-muted-foreground">
      Saving…
    </p>
  ) : null;
}

function yesNo(value: boolean | null): string {
  return value ? "Yes" : "No";
}

/** An answer the system works out, which the dispatcher can override. */
function AutoSelect({
  label,
  auto,
  override,
  disabled,
  onChange,
}: {
  label: string;
  auto: AutoAnswer;
  override: boolean | null;
  disabled: boolean;
  onChange: (next: boolean | null) => void;
}) {
  const id = useId();
  const value = override === null ? "auto" : override ? "yes" : "no";
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value === "auto" ? null : e.target.value === "yes")
        }
        className="ff-input"
      >
        <option value="auto">{`Auto (${yesNo(auto.value)})`}</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
      {auto.note && (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{auto.note}</p>
      )}
    </div>
  );
}

/** An answer only the dispatcher can give. */
function YesNo({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <select
        id={id}
        value={value ? "yes" : "no"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "yes")}
        className="ff-input"
      >
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
    </div>
  );
}

function ReadOnlyNote({ canEdit }: { canEdit: boolean }) {
  return canEdit ? null : (
    <p className="mt-2 text-[0.65rem] text-muted-foreground">
      A dispatcher or Exec Admin sets these.
    </p>
  );
}

export function ComplianceGatesInputs({ flightId, risk, canEdit }: Props) {
  const { save, pending, error } = useRiskSave(flightId);
  const inputs = risk.inputs;
  const disabled = !canEdit || pending;
  return (
    <SectionPanel title="Compliance Gates">
      <div className="grid grid-cols-2 gap-4">
        <AutoSelect
          label="Hazmat Flight"
          auto={risk.automatic.hazmat}
          override={inputs.hazmat_override}
          disabled={disabled}
          onChange={(v) => save({ hazmat_override: v })}
        />
        <YesNo
          label="Hazmat Approved"
          value={inputs.hazmat_approved}
          disabled={disabled}
          onChange={(v) => save({ hazmat_approved: v })}
        />
        <AutoSelect
          label="MEL/DMI on A/C"
          auto={risk.automatic.mel}
          override={inputs.mel_override}
          disabled={disabled}
          onChange={(v) => save({ mel_override: v })}
        />
        <AutoSelect
          label="Pilot Actions Required"
          auto={{ value: risk.automatic.mel.value, note: "" }}
          override={inputs.mel_actions_override}
          disabled={disabled}
          onChange={(v) => save({ mel_actions_override: v })}
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={inputs.mel_actions_complete}
          disabled={disabled}
          onChange={(e) => save({ mel_actions_complete: e.target.checked })}
        />
        MEL/DMI pilot actions complete
      </label>
      <ReadOnlyNote canEdit={canEdit} />
      <SaveState pending={pending} error={error} />
    </SectionPanel>
  );
}

export function CompanyRiskInputs({ flightId, risk, canEdit }: Props) {
  const { save, pending, error } = useRiskSave(flightId);
  const inputs = risk.inputs;
  const disabled = !canEdit || pending;
  const crosswindId = useId();
  const autoCrosswind = risk.automatic.crosswind_kt;
  const [crosswind, setCrosswind] = useState(
    inputs.crosswind_override_kt === null ? "" : String(inputs.crosswind_override_kt),
  );

  function saveCrosswind() {
    const text = crosswind.trim();
    const next = text === "" ? null : Number(text);
    if (next !== null && (!Number.isInteger(next) || next < 0 || next > 99)) return;
    if (next === inputs.crosswind_override_kt) return;
    save({ crosswind_override_kt: next });
  }

  return (
    <SectionPanel title="Company Risk Inputs">
      <div className="grid grid-cols-3 gap-4">
        <AutoSelect
          label="Reporting OK"
          auto={risk.automatic.reporting}
          override={inputs.reporting_override}
          disabled={disabled}
          onChange={(v) => save({ reporting_override: v })}
        />
        <AutoSelect
          label="Night Ops"
          auto={risk.automatic.night}
          override={inputs.night_override}
          disabled={disabled}
          onChange={(v) => save({ night_override: v })}
        />
        <div>
          <label htmlFor={crosswindId} className={LABEL}>
            Crosswind (kt)
          </label>
          <input
            id={crosswindId}
            type="number"
            min={0}
            max={99}
            value={crosswind}
            placeholder={autoCrosswind === null ? "unknown" : `auto: ${autoCrosswind}`}
            disabled={disabled}
            onChange={(e) => setCrosswind(e.target.value)}
            onBlur={saveCrosswind}
            className="ff-input"
          />
          <p className="mt-1 text-[0.65rem] text-muted-foreground">
            {autoCrosswind === null
              ? "Can't be worked out: no wind or runway at any stop."
              : "Leave empty to use the worst stop's best-aligned runway."}
          </p>
        </div>
      </div>
      <ReadOnlyNote canEdit={canEdit} />
      <SaveState pending={pending} error={error} />
    </SectionPanel>
  );
}

/** The area forecast the packet prints: Flight Details' region select,
 *  saved with the flight (#50). */
export function AreaForecastSelect({
  id,
  flightId,
  value,
  regions,
  canEdit,
}: {
  id: string;
  flightId: string;
  value: string | null;
  regions: AreaForecastRegion[];
  canEdit: boolean;
}) {
  const { save, pending, error } = useRiskSave(flightId);
  return (
    <>
      <select
        id={id}
        value={value ?? ""}
        disabled={!canEdit || pending}
        onChange={(e) => save({ area_forecast_product: e.target.value || null })}
        className="ff-input"
      >
        <option value="">Not chosen</option>
        {regions.map((r) => (
          <option key={r.product} value={r.product}>
            {`${r.region} (${r.product})`}
          </option>
        ))}
      </select>
      <SaveState pending={pending} error={error} />
    </>
  );
}

export function ManagementTriggers({ flightId, risk, canEdit }: Props) {
  const { save, pending, error } = useRiskSave(flightId);
  const inputs = risk.inputs;
  const disabled = !canEdit || pending;
  return (
    <SectionPanel title="Management Approval Triggers">
      <div className="grid grid-cols-3 gap-4">
        <YesNo
          label="Outside Pilot Restrictions"
          value={inputs.outside_pilot_restrictions}
          disabled={disabled}
          onChange={(v) => save({ outside_pilot_restrictions: v })}
        />
        <YesNo
          label="VFR Mtn Terrain at Night"
          value={inputs.vfr_mountain_night}
          disabled={disabled}
          onChange={(v) => save({ vfr_mountain_night: v })}
        />
        <AutoSelect
          label="<4 hrs until MX"
          auto={risk.automatic.maintenance}
          override={inputs.maintenance_override}
          disabled={disabled}
          onChange={(v) => save({ maintenance_override: v })}
        />
      </div>
      <p
        className={`mt-3 text-xs font-semibold ${risk.management_required ? "text-status-red" : "text-muted-foreground"}`}
      >
        {risk.management_required ? "Management approval required" : "Management approval not required"}
      </p>
      <label className="mt-2 flex items-center gap-2 text-xs text-foreground">
        <input
          type="checkbox"
          checked={inputs.management_approval_obtained}
          disabled={disabled}
          onChange={(e) => save({ management_approval_obtained: e.target.checked })}
        />
        Mgmt approval obtained
      </label>
      <ReadOnlyNote canEdit={canEdit} />
      <SaveState pending={pending} error={error} />
    </SectionPanel>
  );
}

function NotesBox({
  title,
  hint,
  placeholder,
  initial,
  field,
  flightId,
  canEdit,
}: {
  title: string;
  hint: string;
  placeholder: string;
  initial: string | null;
  field: "non_certified_notes" | "dispatcher_notes";
  flightId: string;
  canEdit: boolean;
}) {
  const { save, pending, error } = useRiskSave(flightId);
  const [text, setText] = useState(initial ?? "");
  const id = useId();
  return (
    <SectionPanel title={title}>
      <label htmlFor={id} className="mb-2 block text-xs text-muted-foreground">
        {hint}
      </label>
      <textarea
        id={id}
        rows={5}
        value={text}
        placeholder={placeholder}
        disabled={!canEdit}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() !== (initial ?? "").trim()) save({ [field]: text });
        }}
        className="ff-input font-mono text-sm"
      />
      <SaveState pending={pending} error={error} />
    </SectionPanel>
  );
}

export function NonCertifiedNotes({ flightId, risk, canEdit }: Props) {
  return (
    <NotesBox
      title="Non-Certified Weather Notes"
      hint="FAA WeatherCams / SayWeather advisory, or an agent's report (for awareness only, not certified). Printed on the packet, and a ceiling, visibility or fog cue here can raise the weather row."
      placeholder="Paste WeatherCams or SayWeather text here..."
      initial={risk.inputs.non_certified_notes}
      field="non_certified_notes"
      flightId={flightId}
      canEdit={canEdit}
    />
  );
}

export function DispatcherNotes({ flightId, risk, canEdit }: Props) {
  return (
    <NotesBox
      title="Dispatcher Notes"
      hint="Printed on the dispatch packet, as on the original."
      placeholder="Notes for the PIC and the record of this release."
      initial={risk.inputs.dispatcher_notes}
      field="dispatcher_notes"
      flightId={flightId}
      canEdit={canEdit}
    />
  );
}

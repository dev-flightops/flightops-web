"use client";

import { useActionState } from "react";

import { buttonSolid } from "@/components/ff/controls";

import { addPayModifierAction, addPayRateAction, type PayFormState } from "./actions";

const _initial: PayFormState = { status: "idle", attempt: 0 };

const INPUT = "ff-input px-2 py-1.5 text-sm";

function Field({ label, width, children }: { label: string; width: string; children: React.ReactNode }) {
  return (
    <label className={width}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Outcome({ state }: { state: PayFormState }) {
  if (state.status === "error" && state.message) {
    return (
      <p role="alert" className="w-full text-xs text-status-red">
        {state.message}
      </p>
    );
  }
  if (state.status === "ok" && state.message) {
    return (
      <p role="status" className="w-full text-xs font-semibold text-status-green">
        {state.message}
      </p>
    );
  }
  return null;
}

/** Add a rate, with legacy's fields (templates/settings/pilot_pay.html). */
export function PayRateForm({
  pilots,
  airframes,
}: {
  pilots: { id: string; name: string }[];
  airframes: string[];
}) {
  const [state, formAction, pending] = useActionState(addPayRateAction, _initial);
  return (
    <form action={formAction} aria-label="Add pay rate" className="flex flex-wrap items-end gap-2">
      <Field label="Type" width="w-36">
        <select name="rate_type" required className={INPUT}>
          <option value="daily">Daily</option>
          <option value="flight_hourly">Flight Hourly</option>
        </select>
      </Field>
      <Field label="Pilot" width="w-44">
        <select name="crew_member_id" className={INPUT}>
          <option value="">All Pilots (Default)</option>
          {pilots.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Airframe" width="w-32">
        <input name="airframe_type" list="pay-rate-airframes" maxLength={40} placeholder="e.g. caravan" className={INPUT} />
        <datalist id="pay-rate-airframes">
          {airframes.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </Field>
      <Field label="YOS Min" width="w-20">
        <input name="year_of_service_min" type="number" min={0} placeholder="0" className={INPUT} />
      </Field>
      <Field label="YOS Max" width="w-20">
        <input name="year_of_service_max" type="number" min={0} placeholder="99" className={INPUT} />
      </Field>
      <Field label="Rate ($)" width="w-24">
        <input name="rate_amount" type="number" min={0} step="0.01" required placeholder="350.00" className={INPUT} />
      </Field>
      <Field label="Effective" width="w-36">
        <input name="effective_date" type="date" required className={INPUT} />
      </Field>
      <Field label="End Date" width="w-36">
        <input name="end_date" type="date" className={INPUT} />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonSolid} h-[34px] px-3 disabled:opacity-60`}>
        {pending ? "Adding…" : "+ Add Rate"}
      </button>
      <Outcome state={state} />
    </form>
  );
}

/** Legacy's list of modifiers (modules/payroll/models.py DEFAULT_MODIFIERS). */
const MODIFIERS = [
  { value: "medevac", label: "Medevac Flight" },
  { value: "night_ops", label: "Night Operations" },
  { value: "ice", label: "Known Icing Conditions" },
  { value: "weather_below_mins", label: "Weather Below Minimums" },
  { value: "training", label: "Training Flight" },
  { value: "check_airman", label: "Check Airman Duty" },
  { value: "holiday", label: "Holiday" },
  { value: "extended_duty", label: "Extended Duty Day" },
  { value: "custom", label: "Custom Modifier" },
];

export function PayModifierForm() {
  const [state, formAction, pending] = useActionState(addPayModifierAction, _initial);
  return (
    <form action={formAction} aria-label="Add modifier" className="flex flex-wrap items-end gap-2">
      <Field label="Modifier" width="w-48">
        <select name="modifier_name" required className={INPUT}>
          {MODIFIERS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Display Label" width="w-44">
        <input name="display_label" required maxLength={80} placeholder="Medevac Premium" className={INPUT} />
      </Field>
      <Field label="Type" width="w-36">
        <select name="modifier_type" required className={INPUT}>
          <option value="flat">Flat $</option>
          <option value="multiplier">Multiplier</option>
          <option value="per_hour">Per Hour</option>
        </select>
      </Field>
      <Field label="Value" width="w-24">
        <input name="modifier_value" type="number" step="0.01" required placeholder="150.00" className={INPUT} />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonSolid} h-[34px] px-3 disabled:opacity-60`}>
        {pending ? "Adding…" : "+ Add Modifier"}
      </button>
      <Outcome state={state} />
    </form>
  );
}

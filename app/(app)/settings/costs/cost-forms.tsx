"use client";

import { useActionState } from "react";

import { buttonSolid } from "@/components/ff/controls";

import {
  saveFuelPriceAction,
  saveLandingFeeAction,
  saveRouteTimeAction,
  type CostFormState,
} from "./actions";

const _initial: CostFormState = { status: "idle", attempt: 0 };

const INPUT = "ff-input px-2 py-1.5 text-sm";
const CODE = `${INPUT} uppercase`;

function Field({ label, width, children }: { label: string; width: string; children: React.ReactNode }) {
  return (
    <label className={width}>
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

function Outcome({ state }: { state: CostFormState }) {
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

function Save({ pending }: { pending: boolean }) {
  return (
    <button type="submit" disabled={pending} className={`${buttonSolid} h-[34px] px-3 disabled:opacity-60`}>
      {pending ? "Saving…" : "Save"}
    </button>
  );
}

/** Legacy's three forms (templates/settings/costs.html). */
export function FuelPriceForm() {
  const [state, formAction, pending] = useActionState(saveFuelPriceAction, _initial);
  return (
    <form action={formAction} aria-label="Add or edit a fuel price" className="mt-3 flex flex-wrap items-end gap-2">
      <Field label="ICAO" width="w-24">
        <input name="icao_code" required minLength={3} maxLength={4} placeholder="PABE" className={CODE} />
      </Field>
      <Field label="$/gal" width="w-24">
        <input name="price_per_gal" type="number" min={0} step="0.01" required placeholder="7.50" className={INPUT} />
      </Field>
      <Field label="Type" width="w-28">
        <select name="fuel_type" defaultValue="Jet-A" className={INPUT}>
          <option value="Jet-A">Jet-A</option>
          <option value="100LL">100LL</option>
        </select>
      </Field>
      <Save pending={pending} />
      <Outcome state={state} />
    </form>
  );
}

export function LandingFeeForm() {
  const [state, formAction, pending] = useActionState(saveLandingFeeAction, _initial);
  return (
    <form action={formAction} aria-label="Add or edit a landing fee" className="mt-3 flex flex-wrap items-end gap-2">
      <Field label="ICAO" width="w-24">
        <input name="icao_code" required minLength={3} maxLength={4} placeholder="PANC" className={CODE} />
      </Field>
      <Field label="Fee $" width="w-24">
        <input name="fee_amount" type="number" min={0} step="1" required placeholder="50" className={INPUT} />
      </Field>
      <Field label="Notes" width="w-44">
        <input name="notes" maxLength={200} className={INPUT} />
      </Field>
      <Save pending={pending} />
      <Outcome state={state} />
    </form>
  );
}

export function RouteTimeForm() {
  const [state, formAction, pending] = useActionState(saveRouteTimeAction, _initial);
  return (
    <form action={formAction} aria-label="Add or edit a route" className="mt-3 flex flex-wrap items-end gap-2">
      <Field label="From" width="w-24">
        <input name="origin_icao" required minLength={3} maxLength={4} placeholder="PABE" className={CODE} />
      </Field>
      <Field label="To" width="w-24">
        <input name="dest_icao" required minLength={3} maxLength={4} placeholder="PAEM" className={CODE} />
      </Field>
      <Field label="Hours" width="w-24">
        <input name="est_flight_hrs" type="number" min={0} step="0.1" required placeholder="1.2" className={INPUT} />
      </Field>
      <Save pending={pending} />
      <Outcome state={state} />
    </form>
  );
}

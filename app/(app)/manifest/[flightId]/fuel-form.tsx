"use client";

import { useActionState } from "react";

import { savePlannedFuelAction, type ManifestFormState } from "./actions";
import { FIELD } from "./manifest-bits";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

/**
 * The fuel dispatch plans to carry, in pounds (#74). It comes off the
 * aircraft's useful load with the crew and the payload, so the load panel
 * shows what is really left for mail and freight. Empty clears it.
 */
export function PlannedFuelForm({ flightId, current }: { flightId: string; current: string | null }) {
  const [state, formAction, pending] = useActionState(savePlannedFuelAction, _initial);
  const shown =
    state.status === "error" ? (state.values?.planned_fuel_lbs ?? "") : current ? String(Number(current)) : "";
  return (
    <form key={state.attempt} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="flight_id" value={flightId} />
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Planned fuel (lb)
        <input
          name="planned_fuel_lbs"
          inputMode="decimal"
          defaultValue={shown}
          placeholder="e.g. 1000"
          className={`${FIELD} w-32`}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
      >
        {pending ? "Saving…" : "Save Fuel"}
      </button>
      {state.status === "error" && state.message ? (
        <p role="alert" className="w-full text-xs text-status-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p role="status" className="w-full text-xs font-semibold text-status-green">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { applyLoadPlanAction, type ManifestFormState } from "./actions";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

/**
 * Put the suggested mail and freight on the manifest (#75). Ops checks it
 * again when it lands: the weight left, the route, what is still waiting.
 * It stays mounted when there is nothing to load, so the message from the
 * last load is still shown after the page refreshes without the button.
 */
export function LoadPlanApply({
  flightId,
  flightNumber,
  items,
  totalLbs,
}: {
  flightId: string;
  flightNumber: string;
  items: { waiting_load_id: string; weight_lbs: string; pieces: number }[];
  totalLbs: string;
}) {
  const [state, formAction, pending] = useActionState(applyLoadPlanAction, _initial);
  if (items.length === 0 && !state.message) return null;
  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-center gap-3">
      <input type="hidden" name="flight_id" value={flightId} />
      <input type="hidden" name="flight_number" value={flightNumber} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      {items.length > 0 ? (
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
        >
          {pending ? "Loading…" : `Load ${Math.round(Number(totalLbs)).toLocaleString()} lb onto ${flightNumber}`}
        </button>
      ) : null}
      {state.status === "error" && state.message ? (
        <p role="alert" className="text-xs text-status-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p role="status" className="text-xs font-semibold text-status-green">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

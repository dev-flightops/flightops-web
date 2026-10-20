"use client";

import { useActionState } from "react";

import { MAIL_CLASS_LABELS, MAIL_CLASSES } from "@/lib/api/manifest";

import { FIELD } from "../[flightId]/manifest-bits";
import { cancelWaitingAction, createWaitingAction, type WaitingFormState } from "./actions";

const _initial: WaitingFormState = { status: "idle", attempt: 0 };

const LABEL = "flex flex-col gap-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground";

/** Log mail or freight waiting at a station (#75). */
export function AddWaitingForm({ station }: { station?: string }) {
  const [state, formAction, pending] = useActionState(createWaitingAction, _initial);
  const v = state.values ?? { station_icao: station ?? "", kind: "bypass_mail" };
  return (
    <form key={state.attempt} action={formAction} className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      <label className={LABEL}>
        At station
        <input name="station_icao" defaultValue={v.station_icao ?? ""} placeholder="PABE" className={FIELD} required />
      </label>
      <label className={LABEL}>
        Going to
        <input name="destination_icao" defaultValue={v.destination_icao ?? ""} placeholder="PAHP" className={FIELD} required />
      </label>
      <label className={LABEL}>
        Mail or cargo
        <select name="kind" defaultValue={v.kind ?? "bypass_mail"} className={FIELD}>
          {MAIL_CLASSES.map((c) => (
            <option key={c} value={c}>
              {MAIL_CLASS_LABELS[c]}
            </option>
          ))}
          <option value="cargo">Cargo / freight</option>
        </select>
      </label>
      <label className={`${LABEL} col-span-2`}>
        Description
        <input name="description" defaultValue={v.description ?? ""} placeholder="Required for cargo" className={FIELD} />
      </label>
      <label className={LABEL}>
        Weight (lb)
        <input name="weight_lbs" inputMode="decimal" defaultValue={v.weight_lbs ?? ""} className={FIELD} required />
      </label>
      <label className={LABEL}>
        Pieces
        <input name="pieces" inputMode="numeric" defaultValue={v.pieces ?? ""} placeholder="1" className={FIELD} />
      </label>
      <label className={LABEL}>
        Shipper
        <input name="shipper" defaultValue={v.shipper ?? ""} className={FIELD} />
      </label>
      <label className={LABEL}>
        Consignee
        <input name="consignee" defaultValue={v.consignee ?? ""} className={FIELD} />
      </label>
      <label className={`${LABEL} col-span-2 sm:col-span-3 lg:col-span-6`}>
        Notes
        <input name="notes" defaultValue={v.notes ?? ""} className={FIELD} />
      </label>
      <div className="col-span-2 flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
        >
          {pending ? "Adding…" : "Add to waiting"}
        </button>
      </div>
      {state.status === "error" && state.message ? (
        <p role="alert" className="col-span-full text-xs text-status-red">
          {state.message}
        </p>
      ) : null}
      {state.status === "ok" && state.message ? (
        <p role="status" className="col-span-full text-xs font-semibold text-status-green">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

/** It went another way. */
export function CancelWaitingButton({ id, label }: { id: string; label: string }) {
  const [state, formAction, pending] = useActionState(cancelWaitingAction, _initial);
  return (
    <form action={formAction} className="inline-flex flex-col items-end">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-label={`Remove ${label} from waiting`}
        className="text-xs text-status-red hover:underline disabled:opacity-60"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      {state.status === "error" && state.message ? (
        <span role="alert" className="text-[0.6875rem] text-status-red">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

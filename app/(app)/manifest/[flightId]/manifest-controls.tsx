"use client";

import { useActionState, useState } from "react";

import { createManifestAction, lockManifestAction, type ManifestFormState } from "./actions";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

function Refusal({ state }: { state: ManifestFormState }) {
  if (state.status !== "error" || !state.message) return null;
  return (
    <p role="alert" className="max-w-sm text-xs text-status-red">
      {state.message}
    </p>
  );
}

/** Start the flight's manifest. Anyone on staff may, as in legacy. */
export function CreateManifestButton({ flightId }: { flightId: string }) {
  const [state, formAction, pending] = useActionState(createManifestAction, _initial);
  return (
    <form action={formAction} className="flex flex-col items-center gap-2">
      <input type="hidden" name="flight_id" value={flightId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create Manifest"}
      </button>
      <Refusal state={state} />
    </form>
  );
}

/** Make the manifest final, after a second click that says what that
 *  means: there is no unlock, in legacy or here. Shown to the check-in
 *  roles only (MANIFEST_LOCKERS); the API refuses everyone else. */
export function LockManifestButton({ flightId, flightNumber }: { flightId: string; flightNumber: string }) {
  const [state, formAction, pending] = useActionState(lockManifestAction, _initial);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-1.5 text-xs font-semibold text-status-yellow hover:bg-status-yellow/20"
        >
          Lock Manifest
        </button>
        <Refusal state={state} />
      </div>
    );
  }
  return (
    <form
      action={formAction}
      onSubmit={() => setAsking(false)}
      className="flex max-w-md flex-col items-end gap-2 rounded-md border border-status-yellow/40 bg-status-yellow/10 p-3"
    >
      <input type="hidden" name="flight_id" value={flightId} />
      <p className="text-right text-xs text-foreground">
        {`Lock ${flightNumber}'s manifest? Nobody can change it after, and there is no unlock.`}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
          Keep Editing
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {pending ? "Locking…" : "Lock It"}
        </button>
      </div>
    </form>
  );
}

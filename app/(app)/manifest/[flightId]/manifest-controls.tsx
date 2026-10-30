"use client";

import { useActionState, useState } from "react";

import {
  createManifestAction,
  lockManifestAction,
  reopenManifestAction,
  type ManifestFormState,
} from "./actions";

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
        className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create Manifest"}
      </button>
      <Refusal state={state} />
    </form>
  );
}

/** Make the manifest final, after a second click that says what that
 *  means. Shown to the check-in roles only (MANIFEST_LOCKERS); the API
 *  refuses everyone else. They may reopen it until departure (#153). */
export function LockManifestButton({ flightId, flightNumber }: { flightId: string; flightNumber: string }) {
  const [state, formAction, pending] = useActionState(lockManifestAction, _initial);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="btn-caps rounded-md border px-3 py-1.5 border-status-yellow/60 text-[0.72rem] text-status-yellow hover:border-status-yellow"
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
      className="notice notice-yellow flex max-w-md flex-col items-end gap-2"
    >
      <input type="hidden" name="flight_id" value={flightId} />
      <p className="text-right text-xs text-foreground">
        {`Lock ${flightNumber}'s manifest? Nobody can change it after unless it's reopened before departure.`}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
          Keep Editing
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
        >
          {pending ? "Locking…" : "Lock It"}
        </button>
      </div>
    </form>
  );
}

/** Reopen a locked manifest until the flight departs (#153): the client's
 *  pilot returned a locked flight over weight and nobody could take a
 *  passenger off. Same roles as locking; the reopen is logged. */
export function ReopenManifestButton({ flightId, flightNumber }: { flightId: string; flightNumber: string }) {
  const [state, formAction, pending] = useActionState(reopenManifestAction, _initial);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="btn-caps rounded-md border border-border px-3 py-1.5 text-[0.72rem] hover:border-foreground"
        >
          Reopen Manifest
        </button>
        <Refusal state={state} />
      </div>
    );
  }
  return (
    <form action={formAction} onSubmit={() => setAsking(false)} className="flex max-w-md flex-col items-end gap-2">
      <input type="hidden" name="flight_id" value={flightId} />
      <p className="text-right text-xs text-foreground">
        {`Reopen ${flightNumber}'s manifest to change it? The reopen is logged with your name. Lock it again when you're done.`}
      </p>
      <div className="flex gap-2">
        <button type="button" onClick={() => setAsking(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent">
          Keep Locked
        </button>
        <button
          type="submit"
          disabled={pending}
          className="btn-caps rounded-md bg-primary px-3 py-1.5 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
        >
          {pending ? "Reopening…" : "Reopen It"}
        </button>
      </div>
    </form>
  );
}

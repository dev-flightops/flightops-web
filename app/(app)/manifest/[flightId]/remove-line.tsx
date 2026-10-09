"use client";

import { useActionState, useState } from "react";

import { removeLineAction, type ManifestFormState } from "./actions";

const _initial: ManifestFormState = { status: "idle", attempt: 0 };

/** Remove a passenger or a cargo or mail line, after a second click that
 *  names what goes (legacy asked with a confirm dialog). */
export function RemoveLine({
  flightId,
  kind,
  lineId,
  label,
}: {
  flightId: string;
  kind: "pax" | "cargo";
  lineId: string;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(removeLineAction, _initial);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="text-xs font-semibold text-status-red hover:underline"
        >
          Remove
        </button>
        {state.status === "error" && state.message ? (
          <span role="alert" className="max-w-[16rem] whitespace-normal text-right text-[0.6875rem] text-status-red">
            {state.message}
          </span>
        ) : null}
      </span>
    );
  }
  return (
    <form action={formAction} onSubmit={() => setAsking(false)} className="inline-flex items-center gap-2">
      <input type="hidden" name="flight_id" value={flightId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="line_id" value={lineId} />
      <span className="text-xs text-muted-foreground">Remove {label}?</span>
      <button
        type="submit"
        disabled={pending}
        className="rounded border border-status-red/40 bg-status-red/10 px-2 py-0.5 text-xs font-semibold text-status-red disabled:opacity-60"
      >
        Remove
      </button>
      <button type="button" onClick={() => setAsking(false)} className="text-xs text-muted-foreground hover:underline">
        Keep
      </button>
    </form>
  );
}

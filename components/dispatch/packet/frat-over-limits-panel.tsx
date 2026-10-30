"use client";

import { useActionState } from "react";

import { acceptOverLimitsAction, type AcceptOverLimitsState } from "@/app/(app)/dispatch/frat-actions";
import { buttonSolid } from "@/components/ff/controls";
import type { FratOverLimits } from "@/lib/api/types";
import { factorLabel } from "@/lib/frat/factors";

const _initial: AcceptOverLimitsState = { status: "idle", attempt: 0 };

function zulu(iso: string): string {
  return `${new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  })}Z`;
}

/**
 * The flight's FRAT, filed over company limits (#152).
 *
 * The operator, 25 Sep: "Over company limits is a no go." The client,
 * 29 Oct: "a manager override at this step. Sends a ping to chief
 * pilot/DO for an acceptance." They get a bell alert that opens this
 * packet; either accepts here, from their own login, with a reason. The
 * pilot's step 4 lets the flight go once one has.
 */
export function FratOverLimitsPanel({
  view,
  canAccept,
}: {
  view: FratOverLimits;
  /** The Chief Pilot or DO (FRAT_OVER_LIMIT_ACCEPTORS). */
  canAccept: boolean;
}) {
  const [state, formAction, pending] = useActionState(acceptOverLimitsAction, _initial);
  const labels = view.over_limit_factors.map(factorLabel).join(" · ");
  const accepted = view.accepted;

  return (
    <section
      aria-label="FRAT over company limits"
      className={`notice text-sm ${accepted ? "notice-green" : "notice-red"}`}
    >
      <p className="notice-label">
        {accepted ? "FRAT over company limits — accepted" : "FRAT over company limits — no-go until accepted"}
      </p>
      <p className="mt-1 text-foreground">
        {`${view.pilot_name ?? "The pilot"} filed the FRAT ${zulu(view.filed_at)} with ${labels} out of company limits.`}
      </p>
      {view.mitigations ? (
        <p className="mt-1 text-muted-foreground">{`Mitigation: “${view.mitigations}”`}</p>
      ) : null}

      {accepted ? (
        <p className="mt-2 text-foreground">
          {`Accepted by ${accepted.authorizer_name} (${accepted.authorizer_role}), ${zulu(accepted.authorized_at)}${
            accepted.notes ? `: “${accepted.notes}”` : "."
          }`}
        </p>
      ) : canAccept ? (
        <form action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="flight_id" value={view.flight_id} />
          <label className="block">
            <span className="field-label">Why it can go</span>
            <textarea name="reason" required rows={2} className="ff-input" />
          </label>
          {state.status === "error" && state.message ? (
            <p role="alert" className="field-error">
              {state.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <button type="submit" disabled={pending} className={buttonSolid}>
              {pending ? "Accepting…" : "Accept over company limits"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-muted-foreground">
          Waiting for the Chief Pilot or the DO to accept it. They have a bell alert.
        </p>
      )}
    </section>
  );
}

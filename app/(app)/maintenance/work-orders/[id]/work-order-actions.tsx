"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import {
  EMPTY_SIGN_OFF,
  SignOffFields,
  signOffProblem,
  toClosure,
  toSignOff,
} from "@/components/maintenance/sign-off-fields";
import { Spinner } from "@/components/ui/spinner";
import type { WorkOrderStatus } from "@/lib/api/maintenance";

import { transitionWorkOrderAction } from "../actions";

const VERB: Record<WorkOrderStatus, string> = {
  open: "Reopen",
  in_progress: "Start work",
  awaiting_parts: "Awaiting parts",
  completed: "Mark completed",
  closed: "Close",
};

/**
 * The work order's next steps (#134). A note goes on the timeline.
 *
 * Closing is signed off (1119-19, the client's 11/19 audit: "Work orders
 * and MELs close with one click: no corrective action, no mechanic or
 * certificate number, no return-to-service entry (14 CFR 43.9)"): the work
 * done, the mechanic, their certificate and their statement, or that no
 * work was done and why. Resolving its squawk on completing or closing
 * returns what it grounded to service, so it takes the same sign-off.
 */
export function WorkOrderActions({
  workOrderId,
  next,
  squawk,
}: {
  workOrderId: string;
  next: WorkOrderStatus[];
  /** The open squawk the viewer may resolve, if any. */
  squawk: { id: string; grounding: boolean } | null;
}) {
  const [note, setNote] = useState("");
  const [resolve, setResolve] = useState(true);
  const [signOff, setSignOff] = useState(EMPTY_SIGN_OFF);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const finishing = next.includes("completed") || next.includes("closed");

  function go(toStatus: WorkOrderStatus) {
    setError(null);
    const closing = toStatus === "closed";
    const resolving = (toStatus === "completed" || closing) && squawk !== null && resolve;
    if (closing || resolving) {
      const problem = signOffProblem(signOff);
      if (problem) {
        setError(problem);
        return;
      }
      if (resolving && signOff.mode === "no_work") {
        setError("Its squawk is resolved only with the work signed off. Untick it to close with no work done.");
        return;
      }
    }
    startTransition(async () => {
      const result = await transitionWorkOrderAction({
        workOrderId,
        toStatus,
        note,
        closure: closing ? toClosure(signOff) : null,
        resolveSquawk: resolving && squawk ? { id: squawk.id, signOff: toSignOff(signOff) } : null,
      });
      if (result.ok) {
        setNote("");
        setSignOff(EMPTY_SIGN_OFF);
      } else setError(result.message);
    });
  }

  return (
    <section aria-label="Next step" className="border-t border-border pt-4">
      <h2 className="section-title mb-2">Next step</h2>
      <label htmlFor="wo-note" className="field-label">
        Note (optional, for the timeline)
      </label>
      <textarea
        id="wo-note"
        rows={2}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="ff-input mb-3 px-3 py-2 text-sm"
      />
      {finishing ? (
        <div className="mb-3 rounded-md border border-border px-3 py-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {next.includes("closed")
              ? "To close it, sign it off, or say why no work was done."
              : "To resolve its squawk, sign it off."}
          </p>
          <SignOffFields
            idPrefix={`wo-${workOrderId}`}
            value={signOff}
            onChange={setSignOff}
            allowNoWork={next.includes("closed")}
            disabled={pending}
          />
        </div>
      ) : null}
      {squawk && finishing && (
        <label className="mb-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="mt-1" />
          <span>
            Resolve the squawk with this sign-off when completing or closing
            {squawk.grounding ? " (returns the aircraft to service)" : ""}
          </span>
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {pending && <Spinner size="xs" />}
        {next.map((to) => (
          <button
            key={to}
            type="button"
            disabled={pending}
            onClick={() => go(to)}
            className={to === "completed" || (to === "in_progress" && !next.includes("completed")) ? buttonSolid : buttonOutline}
          >
            {VERB[to]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-status-red">
          {error}
        </p>
      )}
    </section>
  );
}

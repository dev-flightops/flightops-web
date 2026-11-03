"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
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
 * The work order's next steps (#134). A note goes on the timeline; when
 * completing or closing with its squawk still open, the note is also
 * what was done, and the squawk is resolved with it.
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(toStatus: WorkOrderStatus) {
    setError(null);
    const finishing = toStatus === "completed" || toStatus === "closed";
    startTransition(async () => {
      const result = await transitionWorkOrderAction({
        workOrderId,
        toStatus,
        note,
        resolveSquawkId: finishing && squawk && resolve ? squawk.id : null,
      });
      if (result.ok) setNote("");
      else setError(result.message);
    });
  }

  return (
    <section aria-label="Next step" className="border-t border-border pt-4">
      <h2 className="section-title mb-2">Next step</h2>
      <label htmlFor="wo-note" className="field-label">
        Note {squawk ? "(what was done, when completing)" : "(optional)"}
      </label>
      <textarea
        id="wo-note"
        rows={3}
        maxLength={2000}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="ff-input mb-3 px-3 py-2 text-sm"
      />
      {squawk && (next.includes("completed") || next.includes("closed")) && (
        <label className="mb-3 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={resolve} onChange={(e) => setResolve(e.target.checked)} className="mt-1" />
          <span>
            Resolve the squawk with this note when completing or closing
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

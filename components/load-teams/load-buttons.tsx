"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { Spinner } from "@/components/ui/spinner";

import type { LoadStage } from "./load-status";
import {
  acknowledgeLoadAction,
  completeLoadAction,
  reopenLoadAction,
  startLoadAction,
  type LoadActionResult,
} from "./load-status-actions";

/**
 * The load team's next step on a flight (#134): Acknowledge, Start
 * loading (the ramp timer, LOG-43), then Load complete; Reopen takes
 * "complete" back after a mis-tap. Called directly rather than as form
 * actions, like the Load Team picker.
 */
export function LoadButtons({
  assignmentId,
  stage,
  flightNumber,
}: {
  assignmentId: string;
  stage: LoadStage;
  flightNumber: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(act: (id: string) => Promise<LoadActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await act(assignmentId);
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Spinner size="xs" />}
      {stage === "assigned" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(acknowledgeLoadAction)}
          className={buttonOutline}
        >
          Acknowledge<span className="sr-only"> the load for {flightNumber}</span>
        </button>
      )}
      {(stage === "assigned" || stage === "acknowledged") && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(startLoadAction)}
          className={buttonOutline}
        >
          Start loading<span className="sr-only"> {flightNumber}</span>
        </button>
      )}
      {stage !== "complete" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(completeLoadAction)}
          className={buttonSolid}
        >
          Load complete<span className="sr-only"> for {flightNumber}</span>
        </button>
      )}
      {stage === "complete" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(reopenLoadAction)}
          className={buttonOutline}
        >
          Reopen<span className="sr-only"> the load for {flightNumber}</span>
        </button>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

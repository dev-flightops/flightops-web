"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  deactivateBaseAction,
  type BasesActionState,
} from "@/app/(app)/settings/bases/actions";

export function DeactivateBaseButton({
  baseId,
  icao,
}: {
  baseId: string;
  icao: string;
}) {
  const [state, action, pending] = useActionState<BasesActionState, FormData>(
    deactivateBaseAction,
    { status: "idle" },
  );

  return (
    <form
      action={(formData: FormData) => {
        if (
          !window.confirm(
            `Deactivate ${icao}? The base will hide from dispatch lists. Other tables that reference the ICAO keep working.`,
          )
        )
          return;
        action(formData);
      }}
    >
      <input type="hidden" name="base_id" value={baseId} />
      {state.status === "api-error" && (
        <p
          role="alert"
          className="mr-2 text-[0.65rem] text-status-red"
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-status-red/40 bg-status-red/10 px-2.5 py-1 text-[0.7rem] font-semibold text-status-red hover:bg-status-red/20 disabled:opacity-60"
      >
        {pending && <Spinner size="xs" />}
        Deactivate
      </button>
    </form>
  );
}

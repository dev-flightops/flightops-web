"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { setTeamActiveAction } from "./actions";

/**
 * Deactivate / Reactivate a team — legacy's two card buttons. Confirms
 * on deactivate, as the station toggle does: legacy didn't, but it's
 * the one card action with an effect beyond this page.
 */
export function TeamActiveButton({
  teamId,
  teamName,
  active,
}: {
  teamId: string;
  teamName: string;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    if (
      active &&
      !window.confirm(
        `Deactivate ${teamName}? Ramp Ops and the dispatch packet stop offering it; flights already on it keep it. You can reactivate it from Show Inactive.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setTeamActiveAction(teamId, !active);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={flip}
        disabled={pending}
        aria-label={`${active ? "Deactivate" : "Reactivate"} ${teamName}`}
        className={cn(
          "rounded border bg-transparent px-2.5 py-1 text-[0.65rem] font-semibold transition-colors disabled:opacity-50",
          active
            ? "border-border text-muted-foreground hover:border-status-red/40 hover:text-status-red"
            : "border-status-green/40 text-status-green hover:bg-status-green/10",
        )}
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {error && (
        <span role="alert" className="basis-full text-[0.65rem] text-status-red">
          {error}
        </span>
      )}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { setStationActiveAction } from "./actions";

interface Props {
  stationId: string;
  initial: boolean;
  /** ICAO shown in the confirmation dialog so a misclick on the wrong
   *  row is harder to commit by accident. */
  icaoCode: string;
}

/**
 * Active / Inactive toggle for a station (Spec 6 §"Active / Inactive
 * toggle"). Deactivation hides the station from every dropdown but
 * preserves historical records.
 *
 * Renders as a small button that reads "Deactivate" when active and
 * "Reactivate" when not. Confirms on deactivate (irreversible-feeling
 * action; reactivate doesn't need a confirm).
 */
export function StationActiveToggle({ stationId, initial, icaoCode }: Props) {
  const [active, setActive] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const flip = () => {
    if (active) {
      const ok = window.confirm(
        `Deactivate ${icaoCode}? It'll disappear from base dropdowns and route selectors but historical records stay intact. You can reactivate later.`,
      );
      if (!ok) return;
    }

    const next = !active;
    const previous = active;
    setActive(next);
    setError(null);

    startTransition(async () => {
      const result = await setStationActiveAction(stationId, next);
      if (!result.ok) {
        setActive(previous);
        setError(result.error ?? "Couldn't save — try again.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={flip}
        disabled={pending}
        className={cn(
          "btn-caps rounded-md border px-3 py-1.5 text-[0.72rem] transition-colors disabled:opacity-50",
          active
            ? "border-status-yellow/60 text-status-yellow hover:border-status-yellow"
            : "border-status-green/60 text-status-green hover:border-status-green",
        )}
      >
        {pending ? "Saving…" : active ? "Deactivate" : "Reactivate"}
      </button>
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

import { buttonSolid } from "@/components/ff/controls";

import { setPilotWeightAction } from "./weight-actions";

/**
 * The pilot's weight for weight and balance (#125). The load counts each
 * assigned pilot at the weight here; AC 120-27F publishes no standard
 * weights any more, so 190 lb stands in only when none is on file. Shown
 * to the pilot and the crew managers only: a body weight is personal.
 */
export function PilotWeightCard({
  pilotId,
  weightLbs,
}: {
  pilotId: string;
  weightLbs: number | null;
}) {
  const [value, setValue] = useState(weightLbs == null ? "" : String(weightLbs));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await setPilotWeightAction(pilotId, value);
      if (result.ok) setSaved(true);
      else setError(result.error);
    });
  };

  return (
    <section className="mt-6 rounded-lg border border-border bg-card px-5 py-4">
      <h2 className="eyebrow">Weight for weight and balance</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {weightLbs == null
          ? "None on file: the load counts 190 lb, the standard weight, and says it was estimated."
          : `The load counts ${weightLbs} lb on every flight this pilot is crewed on.`}
      </p>
      <form onSubmit={save} className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="pilot-weight" className="field-label">
            Weight (lb)
          </label>
          <input
            id="pilot-weight"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setSaved(false);
            }}
            className="ff-input w-28 tabular-nums"
          />
        </div>
        <button type="submit" disabled={pending} className={buttonSolid}>
          {pending ? "Saving…" : "Save"}
        </button>
        {saved ? <p className="text-xs text-status-green">Saved.</p> : null}
      </form>
      {error ? (
        <p role="alert" className="field-error mt-2">
          {error}
        </p>
      ) : null}
    </section>
  );
}

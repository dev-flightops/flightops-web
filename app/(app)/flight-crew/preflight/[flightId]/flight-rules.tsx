"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { segment, segmentGroup } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

import { setFlightRulesAction } from "./actions";

/**
 * IFR or VFR, chosen by the pilot at preflight. The client, 18 Nov: "for
 * fuel planning etc. the IFR flight needs to be selectable for any flight
 * by the pilot. I'm not seeing a way for the pilot to select that in the
 * preflight." Until #123 only dispatch could mark a flight IFR, on the
 * flight itself.
 *
 * The FRAT's approach-minimums question, the fuel planning note and the
 * dispatch minimums all read the flight's own rules, so the page is drawn
 * again with them. Once released, the flight keeps the rules it was
 * released under: dispatch pulls a release back to change them, as for
 * any change to the flight.
 */
export function FlightRules({
  flightId,
  isIfr,
  status,
}: {
  flightId: string;
  isIfr: boolean;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const open = status === "scheduled";

  function choose(ifr: boolean) {
    if (ifr === isIfr || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await setFlightRulesAction(flightId, ifr);
      if (!result.ok) {
        setError(result.error ?? "Couldn't change the flight rules.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="flight-rules-heading" className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
      <h2 id="flight-rules-heading" className="eyebrow">
        Flight rules
      </h2>
      {open ? (
        <div role="radiogroup" aria-labelledby="flight-rules-heading" className={segmentGroup}>
          {([false, true] as const).map((ifr) => (
            <button
              key={ifr ? "ifr" : "vfr"}
              type="button"
              role="radio"
              aria-checked={ifr === isIfr}
              disabled={pending}
              onClick={() => choose(ifr)}
              className={cn(segment(ifr === isIfr), "disabled:opacity-60")}
            >
              {ifr ? "IFR" : "VFR"}
            </button>
          ))}
        </div>
      ) : (
        <span className="font-mono text-sm font-semibold text-foreground">{isIfr ? "IFR" : "VFR"}</span>
      )}
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {open
          ? isIfr
            ? "IFR: plan fuel to your alternate, and the FRAT asks about the approach minimums."
            : "Flying IFR? Choose it here: the fuel planning and the FRAT follow."
          : `Released ${isIfr ? "IFR" : "VFR"}. Dispatch pulls the release back to change it.`}
      </p>
      {error ? (
        <p role="alert" className="field-error w-full">
          {error}
        </p>
      ) : null}
    </section>
  );
}

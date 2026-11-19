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
 *
 * An IFR flight names its alternate here too (#201): the fuel estimate in
 * the weight and balance flies on to it.
 */
export function FlightRules({
  flightId,
  isIfr,
  status,
  alternate = null,
}: {
  flightId: string;
  isIfr: boolean;
  status: string;
  /** The IFR flight's alternate (#201), if it has one. */
  alternate?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [typed, setTyped] = useState(alternate ?? "");
  const open = status === "scheduled";

  function saveAlternate() {
    const ident = typed.trim().toUpperCase();
    if (pending || ident === (alternate ?? "")) return;
    if (ident && !/^[A-Z0-9]{3,4}$/.test(ident)) {
      setError("An airport code: 3 or 4 letters and digits, the ICAO or FAA identifier.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await setFlightRulesAction(flightId, true, ident || null);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save the alternate.");
        return;
      }
      router.refresh();
    });
  }

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
      {open && isIfr ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            saveAlternate();
          }}
        >
          <label htmlFor="flight-rules-alternate" className="text-xs text-muted-foreground">
            Alternate
          </label>
          <input
            id="flight-rules-alternate"
            value={typed}
            onChange={(event) => setTyped(event.target.value.toUpperCase())}
            placeholder="e.g. PABE"
            autoComplete="off"
            maxLength={4}
            className="ff-input w-20 py-1 font-mono text-xs uppercase"
          />
          <button
            type="submit"
            disabled={pending || typed.trim().toUpperCase() === (alternate ?? "")}
            className={cn(segment(false), "disabled:opacity-60")}
          >
            Save
          </button>
        </form>
      ) : null}
      <p className="min-w-0 flex-1 text-xs text-muted-foreground">
        {open
          ? isIfr
            ? alternate
              ? `IFR: the fuel estimate flies on to ${alternate}, and the FRAT asks about the approach minimums.`
              : "IFR: name your alternate for the fuel estimate, and the FRAT asks about the approach minimums."
            : "Flying IFR? Choose it here: the fuel planning and the FRAT follow."
          : `Released ${isIfr ? `IFR${alternate ? `, alternate ${alternate}` : ""}` : "VFR"}. Dispatch pulls the release back to change it.`}
      </p>
      {error ? (
        <p role="alert" className="field-error w-full">
          {error}
        </p>
      ) : null}
    </section>
  );
}

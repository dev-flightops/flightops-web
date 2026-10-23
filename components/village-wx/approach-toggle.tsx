"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setInstrumentApproachAction } from "@/app/(app)/village-wx/actions";
import { linkCaps } from "@/components/ff/controls";

/**
 * Whether an instrument approach can be flown at a village airport (#110).
 *
 * The client, 22 Oct: "There is NOT an instrument approach so that is not
 * a legal weather report to fly VFR." Without one the field is reached
 * VFR whatever the aircraft, and the company's dispatch minimums hold
 * every flight there. Everyone sees which; the Director of Operations or
 * an Exec Admin changes it.
 */
export function ApproachToggle({
  airportId,
  icao,
  hasApproach,
  canSet,
}: {
  airportId: string;
  icao: string;
  hasApproach: boolean;
  canSet: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function flip() {
    setError(null);
    startTransition(async () => {
      const result = await setInstrumentApproachAction(airportId, !hasApproach);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[0.7rem]">
      <span className="text-muted-foreground">
        {hasApproach
          ? "Instrument approach can be flown"
          : "No instrument approach: dispatch minimums hold every flight"}
      </span>
      {canSet ? (
        <button
          type="button"
          className={linkCaps}
          disabled={pending}
          onClick={flip}
          aria-label={
            hasApproach
              ? `Mark ${icao} as having no instrument approach`
              : `Mark ${icao} as having an instrument approach`
          }
        >
          {pending ? "Saving…" : hasApproach ? "Mark none" : "Mark approach"}
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="text-status-red">
          {error}
        </span>
      ) : null}
    </div>
  );
}

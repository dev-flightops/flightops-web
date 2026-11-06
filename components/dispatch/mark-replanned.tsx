"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { markReplannedAction } from "@/app/(app)/dispatch/[flightId]/actions";
import { Button } from "@/components/ui/button";

/**
 * Dispatch has re-planned a flight its pilot returned over weight (#174).
 *
 * The card always said to "mark it re-planned", and nothing did. The pilot's
 * step 2 stays refused until then, so the only way on was to cancel the
 * flight: the client's MM1122 read "Payload now 884 lb, within the pilot's
 * figure" with no way to clear it.
 *
 * It isn't refused while the load is still over the pilot's figure: the
 * figure was for that aircraft, and a flight moved to a bigger one reads the
 * same. It asks once, and the pilot still checks the load at step 2.
 */
export function MarkReplanned({
  flightId,
  flightNumber,
  overByLbs = 0,
}: {
  flightId: string;
  flightNumber: string;
  /** How far the payload is over the pilot's figure; 0 when it isn't. */
  overByLbs?: number;
}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function mark() {
    setError(null);
    startTransition(async () => {
      const result = await markReplannedAction(flightId);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="mt-2">
      {asking ? (
        <div role="group" aria-label={`Confirm ${flightNumber} re-planned`}>
          <p className="text-foreground">
            {`It's still ${overByLbs.toLocaleString("en-US")} lb over the pilot's figure. Mark it re-planned anyway? The pilot checks the load again at step 2.`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={mark} disabled={pending}>
              {pending ? "Saving…" : "Mark Re-planned Anyway"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setAsking(false)} disabled={pending}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => (overByLbs > 0 ? setAsking(true) : mark())}
        >
          {pending ? "Saving…" : "Mark Re-planned"}
        </Button>
      )}
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

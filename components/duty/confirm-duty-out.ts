"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Arming a duty-out press, so it takes two.
 *
 * Client bug report, 24 September:
 *
 *   Duty out function: You can accidently close out your duty day
 *
 * Both duty-out controls fired on a single click, and one of them is a
 * pill in the header of every page. What an accidental press costs is
 * not a tidy-up: clocking back in creates a *new* duty period rather
 * than resuming the closed one (ops-service refuses a second open
 * period and inserts a fresh row), so a 14-hour day accidentally split
 * at hour 12 becomes a 12-hour record and a 2-hour one. Two shorter
 * periods each look legal where the single long one was approaching the
 * 14-hour ceiling, and the FRAT's duty factor reads the open period —
 * so the questionnaire would prefill "2h into duty" for a pilot who has
 * been working fourteen. The same accident also resets the rest clock,
 * which then prefills rest as a violation. It corrupts the assessment
 * in both directions.
 *
 * Clocking *in* stays a single press. It is not the destructive
 * direction, and adding friction to starting a duty day would be
 * friction on the honest path.
 *
 * Escape and a click elsewhere both disarm, because an armed control
 * the user has walked away from should not be waiting to fire.
 */
export const NEW_PERIOD_WARNING =
  "Clocking back in starts a new duty period — it does not resume " +
  "this one.";

export function useArmedConfirm(): {
  armed: boolean;
  arm: () => void;
  disarm: () => void;
  /** Attach to the element that must not count as "clicked away". */
  ref: React.RefObject<HTMLDivElement>;
} {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const disarm = useCallback(() => setArmed(false), []);
  const arm = useCallback(() => setArmed(true), []);

  useEffect(() => {
    if (!armed) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(false);
    };
    // pointerdown rather than click: a click that lands on another
    // button would otherwise run that button's handler with this one
    // still armed.
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setArmed(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [armed]);

  return { armed, arm, disarm, ref };
}

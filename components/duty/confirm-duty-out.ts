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
 * pill in the header of every page. Clocking back in used to start a
 * new duty period, so an accident at hour 12 split the day into a
 * 12-hour record and a new one starting at zero.
 *
 * The client, 27 Sep: "It's all one continuous period. So, if you click
 * the start duty day again it should be reopening your duty day." It
 * does now: inside the operator's minimum rest, ops-service reopens the
 * period. The confirmation stays, because closing is still the end of
 * the duty day as far as anyone reading the clock can tell.
 *
 * Clocking *in* stays a single press. It is not the destructive
 * direction, and adding friction to starting a duty day would be
 * friction on the honest path.
 *
 * Escape and a click elsewhere both disarm, because an armed control
 * the user has walked away from should not be waiting to fire.
 */
/** What clocking back in does after this close. */
export function resumeNote(minRestHours: number): string {
  return (
    `Clocking back in within ${minRestHours}h resumes this duty day; ` +
    "after a full rest, a new one starts."
  );
}

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

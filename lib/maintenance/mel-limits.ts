import type { MelLimitBreach, MelOperatingLimit } from "@/lib/api/types";

/**
 * What an MEL deferral limits the aircraft to (#200). The client, 18 Nov:
 * "I squawked a nav light. Went into mx side and gave it a DAY VFR MEL ...
 * can the system see what the end of civil twilight is and block the flight
 * from happening with that asset because it would violate the MEL?"
 */
export const MEL_LIMIT_LABELS: Record<MelOperatingLimit, string> = {
  day_vfr: "Day VFR only",
  vfr: "VFR only",
};

export function melLimitLabel(limit: MelOperatingLimit | null | undefined): string | null {
  return limit ? MEL_LIMIT_LABELS[limit] : null;
}

/** What to do about a flight that breaks one: the sentence after the
 *  service's own ("N100PA is day VFR only under MEL 33-40: ..."). */
export function melLimitRemedy(breaches: MelLimitBreach[]): string {
  if (breaches.some((b) => b.ifr)) return "Fly it VFR, or put another aircraft on it.";
  return "Move it into daylight, or put another aircraft on it.";
}

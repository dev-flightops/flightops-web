/**
 * Words for the FRAT sign-off (#155), kept apart from the components so a
 * test can read them without rendering.
 */

/** "2 h 15 min", or "not known". */
export function hoursMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "not known";
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** The pilot's line on the signed FRAT, as the client asked: flight
 *  minutes flown and remaining for the day at signing. */
export function pilotMinutesLine(
  today: number | null | undefined,
  remaining: number | null | undefined,
): string {
  return `Flight time in the 24 hours before signing: ${hoursMinutes(today)} flown, ${hoursMinutes(remaining)} remaining (14 CFR 135.265(a)(1)).`;
}

/** What a 409 from the sign or approve endpoints means to the person. */
export function signErrorMessage(detail: string): string {
  if (detail.includes("frat_changed")) {
    return "The FRAT changed since you opened it. Read it again, then sign.";
  }
  if (detail.includes("frat_locked")) {
    return "The flight is released, so its FRAT can't change. Pull the release back first.";
  }
  if (detail.includes("not_the_pilot")) return "Only the FRAT's pilot signs the pilot's box.";
  if (detail.includes("not_a_dispatcher")) return "Only a dispatcher signs the dispatcher's box.";
  if (detail.includes("same_person_signs_both")) {
    return "You signed the other box: someone else signs this one.";
  }
  if (detail.includes("already_signed")) return "That box is already signed.";
  if (detail.includes("nothing_to_approve")) return "Nothing on this FRAT waits for approval.";
  if (detail.includes("reason_required")) return "Write the reason first.";
  return "Couldn't sign the FRAT. Try again.";
}

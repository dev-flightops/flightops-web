/**
 * Why an aircraft is out of the fleet (audit 1110-16). Out of the fleet
 * is `is_active` false, which means two things: retired from Settings →
 * Fleet, or grounded, by the MEL expiry job (an MEL item past due, until
 * it is closed) or by hand. Settings → Fleet listed every one as retired,
 * so a grounded aircraft's open MEL items read as a retired one's.
 */
export function outOfService(aircraft: { is_active: boolean; grounded_reason?: string | null }):
  | "retired"
  | "grounded"
  | null {
  if (aircraft.is_active) return null;
  return aircraft.grounded_reason ? "grounded" : "retired";
}

/** The grounding, said the way the fleet list says it. */
export function groundedBecause(reason: string | null | undefined): string {
  if (reason === "mel_expired") return "Grounded: an MEL item is past due";
  if (reason === "manual") return "Grounded by maintenance";
  return "Grounded";
}

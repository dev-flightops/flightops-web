/**
 * What the load leaves for passengers, worked out rather than left to
 * the pilot.
 *
 * Step 2 showed four facts — max payload 1,400 lbs, 6 pax, 350 lbs
 * cargo — and then asked the pilot to decide "within limits" or "over
 * limits". Every number needed to narrow that question was on the
 * screen and none of the arithmetic was done, so a pilot stood on a
 * ramp working out whether six passengers fit in 1,050 lbs.
 *
 * WHY THIS DOES NOT JUST TOTAL THE WEIGHT
 *
 * Because it cannot, and must not pretend to. Totalling needs a weight
 * per passenger, and there are only two honest sources:
 *
 *   A manifest. `ManifestPax.weight_lbs` is required and its model says
 *   why: "default weights are legacy behavior we skip in favor of
 *   explicit-only." When a manifest exists the real total is knowable.
 *   Three flights in the demo tenant have one.
 *
 *   A standard average weight from the operator's ops specs. We hold
 *   none, and inventing 190 lb — the common figure — would be a number
 *   nobody signed appearing inside a weight-and-balance decision. The
 *   data model already refuses that trade.
 *
 * So this computes the half that needs no assumption: subtract the
 * cargo from the max payload and divide what remains by the number of
 * passengers. That turns "is this over?" into "is my average passenger
 * under 175 lb?", which a pilot can answer from the ramp without doing
 * any sums, and it states a figure the operator's own limits imply
 * rather than one we chose.
 *
 * The pilot still records the verdict. They are the authority, they can
 * see late changes the system cannot, and no arithmetic here is a
 * substitute for the aircraft's loading schedule.
 */

export interface PayloadAllowance {
  /** Payload left for passengers after cargo, in pounds. Negative when
   *  the cargo alone exceeds the aircraft's payload. */
  remainingForPaxLbs: number;
  /** The average each passenger must come in under, rounded down so the
   *  figure is never optimistic. Null when nobody is booked — dividing
   *  by zero passengers has no meaning, and "unlimited" would be a
   *  dangerous way to render it. */
  perPassengerLbs: number | null;
  /** True when the cargo on its own is already over the payload. No
   *  passenger weight can rescue this, so it is over limits on numbers
   *  the system holds outright. */
  cargoAloneExceedsPayload: boolean;
}

export function payloadAllowance(input: {
  maxPayloadLbs: number | null | undefined;
  paxCount: number | null | undefined;
  cargoLbs: number | null | undefined;
}): PayloadAllowance | null {
  const { maxPayloadLbs } = input;
  // No recorded payload limit means no arithmetic is possible. The
  // aircraft's limit comes from its loading schedule, not from us, and
  // a missing one has to read as missing.
  if (maxPayloadLbs == null || maxPayloadLbs <= 0) return null;

  const cargo = input.cargoLbs ?? 0;
  const pax = input.paxCount ?? 0;
  const remaining = maxPayloadLbs - cargo;

  return {
    remainingForPaxLbs: remaining,
    perPassengerLbs: pax > 0 && remaining > 0 ? Math.floor(remaining / pax) : null,
    cargoAloneExceedsPayload: remaining < 0,
  };
}

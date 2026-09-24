/**
 * Pydantic serialises `Decimal` as a JSON *string*, not a number.
 *
 * So `vfr_min_visibility_sm` arrives as `"3.0"` while every TypeScript
 * type in this codebase declares it `number`. String interpolation
 * hides it — "against a 3.0 sm floor" reads correctly — so it surfaces
 * only where the value is used as a number, and then silently:
 *
 *   Number.isFinite("3.0")   // false
 *   "3.0" > 10               // false, by accident
 *   "3.0" + 1                // "3.01"
 *
 * The first of those made the FRAT policy unsaveable: the form seeded
 * its state straight from the response, the save guard called
 * `Number.isFinite` on it, and the Chief Pilot got "The VFR visibility
 * floor has to be between 0 and 10 miles" about a value of 3 — unless
 * they happened to retype that one field first, which parsed it.
 *
 * Coerced at the client boundary rather than by widening the type to
 * `number | string`, because the type is not wrong about what the value
 * *is* — a visibility in statute miles is a number. It is the wire that
 * needs normalising, and doing it here means no consumer has to know.
 */
export function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  // Explicitly, before Number() gets it: `Number(null)` is 0 and
  // `Number("")` is 0, both finite. A missing field would become a
  // silent zero — and on these fields zero is a real policy ("do not
  // score visibility"), so it would be indistinguishable from one the
  // operator chose.
  if (value === null || value === undefined || value.trim() === "") {
    throw new TypeError(`Expected a numeric value, got ${String(value)}`);
  }
  const parsed = Number(value);
  // NaN would propagate into a range check and read as "out of range"
  // rather than "unreadable", which is how this bug presented in the
  // first place. Throwing is louder and the caller is a server action
  // that already reports failures.
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`Expected a numeric value, got ${String(value)}`);
  }
  return parsed;
}

/** Same, for a field that is legitimately absent. */
export function asNumberOrNull(
  value: number | string | null | undefined,
): number | null {
  if (value === null || value === undefined) return null;
  return asNumber(value);
}

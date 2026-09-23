import type { FratThresholdConfigResponse } from "@/lib/api/types";

/**
 * Which company crosswind limit applies to an aircraft.
 *
 * The operator, 22 September 2026:
 *
 *   crosswinds is tricky because demonstrated does not limit us. Our
 *   single engine x wind limits are 30kts multi engines are 35kts.
 *   That's a company limit. And many companies operate above the
 *   demonstrated limit. Within 10 knots of a limit is near.
 *
 * So the FRAT's wind factor is written against the operator's own
 * limit, selected by engine count — not
 * `aircraft.max_demonstrated_crosswind_kt`, which is what it used to
 * show the pilot and which the operator says does not bind them.
 *
 * DELIBERATELY A DUPLICATE, AND MEANT TO BE DELETED
 *
 * `flightops_shared/frat_limits.py` has this same selection rule, and
 * two copies of one rule is the drift pattern this codebase keeps
 * getting bitten by. It is here anyway because the pilot needs the
 * number on screen now, and the backend has no per-flight endpoint that
 * returns the applicable limit yet.
 *
 * When the FRAT prefill ships, the server will send the limit it
 * actually scored against and this module should go. Until then the
 * risk is bounded: this only labels a field, the Python is what scores,
 * and the numbers both read come from the same tenant row.
 */
export function companyCrosswindLimitKt(
  config: Pick<
    FratThresholdConfigResponse,
    "crosswind_single_engine_kt" | "crosswind_multi_engine_kt"
  >,
  engineCount: number | null | undefined,
): number | null {
  // Not defaulted to single-engine when unknown. The lower limit would
  // show the pilot a stricter number than the operator's policy and the
  // higher a looser one; both are wrong, and a wrong limit on screen is
  // worse than an visible gap because it looks answered.
  if (engineCount == null || engineCount < 1) return null;
  return engineCount === 1
    ? config.crosswind_single_engine_kt
    : config.crosswind_multi_engine_kt;
}

/**
 * Where "near the limit" begins, in knots.
 *
 * The margin is subtracted from the limit, so a 10 kt margin on a 30 kt
 * limit puts the boundary at 20. Null when no limit applies.
 */
export function nearLimitEntryKt(
  config: Pick<
    FratThresholdConfigResponse,
    | "crosswind_single_engine_kt"
    | "crosswind_multi_engine_kt"
    | "crosswind_near_margin_kt"
  >,
  engineCount: number | null | undefined,
): number | null {
  const limit = companyCrosswindLimitKt(config, engineCount);
  if (limit == null) return null;
  return limit - config.crosswind_near_margin_kt;
}

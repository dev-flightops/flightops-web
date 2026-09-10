import { cn } from "@/lib/utils";

/**
 * Big rounded pill that surfaces the daily Ops Score — the headline
 * number at the top-right of the Executive view + the center of the
 * Ops Score view. Color tracks the score band:
 *
 *   90-100  excellent       (green)
 *   75-89   good            (light green / yellow-green)
 *   60-74   fair            (orange)
 *   0-59    needs attention (red)
 *
 * Legacy peregrineflight uses "Needs Attention" rather than "Poor" for
 * the bottom band — softer phrasing for a customer-facing dial.
 */
export function ScorePill({
  score,
  size = "default",
  band,
}: {
  score: number;
  size?: "default" | "large";
  /** Band decided by the caller. Pass it when the score is not out of
   *  100 — the ops score has unmeasurable pillars, so its service
   *  bands against the achievable maximum. Omit it and the thresholds
   *  below apply, which is correct for any true percentage. */
  band?: string | null;
}) {
  const rating = band ? ratingForBand(band) : ratingFor(score);
  return (
    <div
      className={cn(
        "inline-flex items-baseline gap-2 rounded-full border px-4 py-1.5",
        rating.bg,
        rating.border,
        size === "large" && "px-8 py-4",
      )}
    >
      <span
        className={cn(
          "font-mono font-bold tabular-nums",
          rating.text,
          size === "large" ? "text-5xl" : "text-xl",
        )}
      >
        {score.toFixed(1)}
      </span>
      <span
        className={cn(
          "font-semibold",
          rating.text,
          size === "large" ? "text-sm" : "text-[0.7rem]",
        )}
      >
        {rating.label}
      </span>
    </div>
  );
}

/**
 * Tone for a band the caller already decided.
 *
 * The thresholds below read the score against a flat 100, which is
 * right only while 100 is achievable. The ops score has pillars it
 * cannot measure, so its service bands against the achievable maximum
 * instead — and a perfect day scoring 97 of 97 must read "Excellent",
 * not be re-judged here against 100.
 */
function ratingForBand(band: string) {
  if (band === "Excellent") return ratingFor(95);
  if (band === "Good") return ratingFor(80);
  if (band === "Fair") return ratingFor(65);
  return ratingFor(0);
}

function ratingFor(score: number) {
  if (score >= 90)
    return {
      label: "Excellent",
      text: "text-status-green",
      bg: "bg-status-green/10",
      border: "border-status-green/30",
    };
  if (score >= 75)
    return {
      label: "Good",
      text: "text-status-green",
      bg: "bg-status-green/[0.06]",
      border: "border-status-green/20",
    };
  if (score >= 60)
    return {
      label: "Fair",
      text: "text-status-orange",
      bg: "bg-status-orange/10",
      border: "border-status-orange/30",
    };
  return {
    label: "Needs Attention",
    text: "text-status-red",
    bg: "bg-status-red/10",
    border: "border-status-red/30",
  };
}

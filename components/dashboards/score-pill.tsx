import { StatusMark } from "@/components/ff/status-mark";
import { cn } from "@/lib/utils";

/**
 * The daily Ops Score — the headline figure at the top-right of the
 * Executive view and the centre of the Ops Score view. Since #82 it is a
 * figure with its band as a status mark, not a pill. The band's colour:
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
  // A figure with its rating as a status mark (#82), not a tinted pill:
  // the score in the display face, the band in its colour beside it.
  return (
    <div className={cn("inline-flex items-baseline gap-3", size === "large" && "flex-col items-center gap-2")}>
      <span
        className={cn(
          "font-display font-extrabold leading-none tabular-nums text-foreground",
          size === "large" ? "text-6xl" : "text-[1.75rem]",
        )}
      >
        {score.toFixed(1)}
      </span>
      <StatusMark label={rating.label} tone={rating.tone} className={size === "large" ? "text-xs" : undefined} />
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
      tone: "green" as const,
    };
  if (score >= 75)
    return {
      label: "Good",
      tone: "green" as const,
    };
  if (score >= 60)
    return {
      label: "Fair",
      tone: "orange" as const,
    };
  return {
    label: "Needs Attention",
    tone: "red" as const,
  };
}

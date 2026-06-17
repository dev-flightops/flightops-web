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
}: {
  score: number;
  size?: "default" | "large";
}) {
  const rating = ratingFor(score);
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

import { cn } from "@/lib/utils";
import type { FlightCategory } from "@/lib/api/types";

/**
 * FAA flight-category pill (VFR / MVFR / IFR / LIFR).
 *
 * Color scheme matches aviationweather.gov:
 *   VFR   green     ceiling ≥ 3000 ft AND vis ≥ 5 SM
 *   MVFR  blue      ceiling 1000-3000 ft OR vis 3-5 SM
 *   IFR   red       ceiling 500-1000 ft  OR vis 1-3 SM
 *   LIFR  magenta   ceiling < 500 ft     OR vis < 1 SM
 *
 * Extracted from the dispatch packet weather panel during M2-G-24 so
 * the standalone /weather page can render the same badge without
 * pulling the whole panel.
 */
const FLIGHT_CATEGORY_STYLE: Record<
  FlightCategory,
  { className: string; title: string }
> = {
  VFR: {
    className: "bg-status-green/15 text-status-green",
    title: "VFR — ceiling ≥ 3000 ft and visibility ≥ 5 SM",
  },
  MVFR: {
    className: "bg-status-blue/15 text-status-blue",
    title: "Marginal VFR — ceiling 1000–3000 ft or visibility 3–5 SM",
  },
  IFR: {
    className: "bg-status-red/15 text-status-red",
    title: "IFR — ceiling 500–1000 ft or visibility 1–3 SM",
  },
  LIFR: {
    className: "bg-status-purple/15 text-status-purple",
    title: "Low IFR — ceiling < 500 ft or visibility < 1 SM",
  },
};

export function FlightCategoryBadge({
  category,
  size = "md",
}: {
  category: FlightCategory;
  size?: "md" | "lg";
}) {
  const { className, title } = FLIGHT_CATEGORY_STYLE[category];
  const sizeClass =
    size === "lg"
      ? "px-2 py-0.5 text-[0.7rem]"
      : "px-1.5 py-0.5 text-[0.6rem]";
  return (
    <span
      className={cn(
        "rounded-md font-bold uppercase tracking-[0.08em]",
        sizeClass,
        className,
      )}
      title={title}
    >
      {category}
    </span>
  );
}

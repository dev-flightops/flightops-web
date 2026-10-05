import type { ScheduleTagTone } from "@/lib/api/crew-calendar";

/** A tag's colour, from the theme's status tones (#44). */
export const TAG_TONE: Record<ScheduleTagTone, string> = {
  blue: "border-status-blue/40 bg-status-blue/15 text-status-blue",
  green: "border-status-green/40 bg-status-green/15 text-status-green",
  yellow: "border-status-yellow/40 bg-status-yellow/15 text-status-yellow",
  orange: "border-status-orange/40 bg-status-orange/15 text-status-orange",
  red: "border-status-red/40 bg-status-red/15 text-status-red",
  purple: "border-status-purple/40 bg-status-purple/15 text-status-purple",
  teal: "border-status-teal/40 bg-status-teal/15 text-status-teal",
  gray: "border-status-gray/40 bg-status-gray/15 text-status-gray",
};

/** A swatch for the colour picker. */
export const TAG_SWATCH: Record<ScheduleTagTone, string> = {
  blue: "bg-status-blue",
  green: "bg-status-green",
  yellow: "bg-status-yellow",
  orange: "bg-status-orange",
  red: "bg-status-red",
  purple: "bg-status-purple",
  teal: "bg-status-teal",
  gray: "bg-status-gray",
};

/** What fits in a 30px day cell; the whole label shows on hover. */
export function shortTagLabel(label: string): string {
  return label.length <= 4 ? label : label.slice(0, 4);
}

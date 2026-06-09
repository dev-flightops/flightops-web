import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  DISPLAY_LABELS,
  DISPLAY_VALUES,
  flightFollowingHref,
  type FlightFollowingDisplay,
  type FlightFollowingView,
} from "./view-types";

/**
 * Display mode toggle: List / Split / Map.
 *
 * Like the filter tabs this is URL-driven (preserves `?view=` while
 * swapping `?display=`) so each combination is deep-linkable. The
 * active mode is filled with status-blue and the others sit on a
 * subtle bordered chip group, matching the legacy board.html.
 */
export function DisplayToggle({
  view,
  activeDisplay,
}: {
  view: FlightFollowingView;
  activeDisplay: FlightFollowingDisplay;
}) {
  return (
    <div
      className="flex gap-1 rounded-md border border-border p-0.5"
      role="tablist"
      aria-label="Flight following display mode"
    >
      {DISPLAY_VALUES.map((display) => {
        const isActive = display === activeDisplay;
        return (
          <Link
            key={display}
            href={flightFollowingHref(view, display)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded px-3 py-1 text-xs font-semibold transition-colors",
              isActive
                ? "bg-status-blue text-white"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {display === "list" && (
              <span aria-hidden className="mr-1">
                ☰
              </span>
            )}
            {DISPLAY_LABELS[display]}
          </Link>
        );
      })}
    </div>
  );
}

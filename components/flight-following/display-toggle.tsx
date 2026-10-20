import Link from "next/link";

import { segment, segmentGroup } from "@/components/ff/controls";

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
 * active mode is filled with the brand (primary) and the others sit on a
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
      className={segmentGroup}
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
            className={segment(isActive)}
          >
            {DISPLAY_LABELS[display]}
          </Link>
        );
      })}
    </div>
  );
}

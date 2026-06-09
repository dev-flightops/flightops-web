import Link from "next/link";

import { cn } from "@/lib/utils";

import {
  VIEW_LABELS,
  VIEW_VALUES,
  flightFollowingHref,
  type FlightFollowingDisplay,
  type FlightFollowingView,
} from "./view-types";

/**
 * Day-window filter tabs: Today / Tomorrow / 7 Day / All Planned.
 *
 * Each tab is a Link that preserves the current display mode in the
 * URL, so switching filters keeps the user in their chosen view
 * (list/split/map). The active tab is filled with status-blue to
 * match the legacy board.html.
 */
export function FilterTabs({
  activeView,
  display,
}: {
  activeView: FlightFollowingView;
  display: FlightFollowingDisplay;
}) {
  return (
    <div
      className="flex flex-wrap gap-1"
      role="tablist"
      aria-label="Flight following date filter"
    >
      {VIEW_VALUES.map((view) => {
        const isActive = view === activeView;
        return (
          <Link
            key={view}
            href={flightFollowingHref(view, display)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "bg-status-blue text-white"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {VIEW_LABELS[view]}
          </Link>
        );
      })}
    </div>
  );
}

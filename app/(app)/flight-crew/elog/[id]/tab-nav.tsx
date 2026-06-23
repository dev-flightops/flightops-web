import Link from "next/link";

import { cn } from "@/lib/utils";

import { TAB_KEYS, TAB_LABELS, type TabKey } from "./tabs";

/**
 * Horizontal tab bar across the top of the elog detail page.
 *
 * Each tab is a numbered Link that swaps the `?tab=` query param;
 * because tabs are URL-driven the page stays server-rendered and the
 * back/forward buttons work as expected. Numbering ("1. Flight Info",
 * "2. Legs", …) mirrors legacy `templates/elog/log_page.html`.
 */
export function TabNav({
  activeTab,
  logId: _logId,
}: {
  activeTab: TabKey;
  /** Reserved for future per-tab routing changes (e.g. /elog/[id]/[tab]).
   *  Today every tab lives on the same page with `?tab=…`. */
  logId: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Flight log sections"
      className="flex flex-wrap gap-1 overflow-x-auto border-b border-border pb-1"
    >
      {TAB_KEYS.map((key, idx) => {
        const isActive = key === activeTab;
        const href = key === "info" ? `?` : `?tab=${key}`;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            aria-selected={isActive}
            replace
            className={cn(
              "rounded-t-md border-b-2 px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap",
              isActive
                ? "border-status-blue text-status-blue"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {idx + 1}. {TAB_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
}

import Link from "next/link";

import { tab, tabList } from "@/components/ff/controls";
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
  // The page's own tabs in the department nav's idiom (#81): words, the
  // current one underlined in the brand's text tone.
  return (
    <div role="tablist" aria-label="Flight log sections" className={tabList}>
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
            className={cn(tab(isActive), "whitespace-nowrap")}
          >
            {/* The tab is a flex box, which drops the space; the margin
                draws it and the space keeps the name "1. Flight Info". */}
            <span className="mr-1.5 font-mono text-[0.7rem] text-muted-foreground">{idx + 1}.</span>
            {" "}
            {TAB_LABELS[key]}
          </Link>
        );
      })}
    </div>
  );
}

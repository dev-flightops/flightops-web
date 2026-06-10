import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Status filter tabs shared between the /maintenance/mel and
 * /maintenance/squawks list pages (M2-G-21).
 *
 * URL-driven via the `?status=` query param so each tab is deep-
 * linkable and the back button works the way a dispatcher expects.
 * Pass an "all" entry by including null in `statuses` if the caller
 * wants an unfiltered view.
 */
export interface StatusTabOption<S extends string> {
  value: S | null;
  label: string;
}

export function StatusFilterTabs<S extends string>({
  basePath,
  options,
  activeStatus,
  aircraftId,
}: {
  basePath: string;
  options: StatusTabOption<S>[];
  /** null = "All" tab active. */
  activeStatus: S | null;
  /** Preserved through tab navigation so the aircraft filter doesn't
   *  reset when the user switches status. */
  aircraftId?: string;
}) {
  const buildHref = (status: S | null) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (aircraftId) params.set("aircraft", aircraftId);
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div
      role="tablist"
      aria-label="Status filter"
      className="flex flex-wrap gap-1"
    >
      {options.map((opt) => {
        const isActive = opt.value === activeStatus;
        return (
          <Link
            key={opt.value ?? "all"}
            href={buildHref(opt.value)}
            role="tab"
            aria-selected={isActive}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              isActive
                ? "bg-status-blue text-white"
                : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
            )}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

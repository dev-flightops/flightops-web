import Link from "next/link";

import type { CpReviewStatus } from "@/lib/api/types";

const FILTERS: ReadonlyArray<{ key: CpReviewStatus; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "declined", label: "Declined" },
];

export function CpReviewStatusFilter({
  active,
}: {
  active: CpReviewStatus;
}) {
  return (
    <nav
      aria-label="Filter CP reviews by status"
      className="mb-4 flex flex-wrap gap-2"
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        const href =
          f.key === "pending"
            ? "/flight-crew/elog/cp-reviews"
            : `/flight-crew/elog/cp-reviews?status=${f.key}`;
        return (
          <Link
            key={f.key}
            href={href}
            aria-pressed={isActive}
            className={
              "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors " +
              (isActive
                ? "border-status-blue/60 bg-status-blue/15 text-status-blue"
                : "border-border bg-card text-muted-foreground hover:text-foreground")
            }
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}

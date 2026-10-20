import Link from "next/link";

import { segment, segmentGroup } from "@/components/ff/controls";
import type { CpReviewStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

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
    <nav aria-label="Filter CP reviews by status" className={cn(segmentGroup, "mb-4")}>
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
            className={segment(isActive)}
          >
            {f.label}
          </Link>
        );
      })}
    </nav>
  );
}

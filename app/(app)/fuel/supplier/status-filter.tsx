import Link from "next/link";

import type { FuelOrderStatus } from "@/lib/api/types";

const FILTERS: ReadonlyArray<{ key: FuelOrderStatus | null; label: string }> = [
  { key: null, label: "All" },
  { key: "ordered", label: "New" },
  { key: "confirmed", label: "Acknowledged" },
  { key: "fueled", label: "Fueled" },
  { key: "discrepancy", label: "Discrepancy" },
  { key: "cancelled", label: "Cancelled" },
];

/**
 * Status filter pills for the supplier portal inbox. "Ordered" gets
 * relabeled "New" — that's what shows up unacknowledged from a
 * supplier's perspective.
 */
export function SupplierStatusFilter({
  active,
}: {
  active: FuelOrderStatus | null;
}) {
  return (
    <nav
      aria-label="Filter supplier orders by status"
      className="mb-4 flex flex-wrap gap-2"
    >
      {FILTERS.map((f) => {
        const isActive = f.key === active;
        const href = f.key
          ? `/fuel/supplier?status=${f.key}`
          : "/fuel/supplier";
        return (
          <Link
            key={f.label}
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

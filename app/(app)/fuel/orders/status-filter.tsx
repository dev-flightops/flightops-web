"use client";

import Link from "next/link";

import type { FuelOrderStatus } from "@/lib/api/types";

const OPTIONS: { value: FuelOrderStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "ordered", label: "Ordered" },
  { value: "confirmed", label: "Confirmed" },
  { value: "fueled", label: "Fueled" },
  { value: "discrepancy", label: "Discrepancy" },
  { value: "cancelled", label: "Cancelled" },
];

export function OrdersStatusFilter({
  active,
}: {
  active: FuelOrderStatus | undefined;
}) {
  return (
    <div
      role="group"
      aria-label="Status filter"
      className="mb-4 flex flex-wrap gap-2"
    >
      {OPTIONS.map((o) => {
        const on = (active ?? "") === o.value;
        return (
          <Link
            key={o.value || "all"}
            href={o.value ? `/fuel/orders?status=${o.value}` : "/fuel/orders"}
            className={`rounded-md border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] transition-colors ${
              on
                ? "border-status-blue bg-status-blue/15 text-status-blue"
                : "border-border bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

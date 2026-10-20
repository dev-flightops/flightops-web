"use client";

import Link from "next/link";

import { segment, segmentGroup } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

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
      className={cn(segmentGroup, "mb-4")}
    >
      {OPTIONS.map((o) => {
        const on = (active ?? "") === o.value;
        return (
          <Link
            key={o.value || "all"}
            href={o.value ? `/fuel/orders?status=${o.value}` : "/fuel/orders"}
            aria-current={on ? "page" : undefined}
            className={segment(on)}
          >
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}

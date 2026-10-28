"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { segment, segmentGroup } from "@/components/ff/controls";
import type { FlightStatus } from "@/lib/api/types";

const OPTIONS: { value: FlightStatus; label: string }[] = [
  { value: "scheduled", label: "Planned" },
  { value: "released", label: "Released" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function StatusFilter({
  date,
  statuses,
  view,
}: {
  date: string;
  statuses: FlightStatus[];
  /** "list" keeps the list view (#139); the default is by aircraft. */
  view?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const toggle = (s: FlightStatus) => {
    const set = new Set(statuses);
    if (set.has(s)) set.delete(s);
    else set.add(s);
    const params = new URLSearchParams();
    params.set("date", date);
    if (set.size > 0) {
      params.set("statuses", [...set].sort().join(","));
    }
    if (view === "list") params.set("view", "list");
    startTransition(() => {
      router.replace(`/schedule?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label="Status filter"
      className="mb-4 flex flex-wrap items-center gap-3"
    >
      <span className="eyebrow">Show</span>
      <span className={segmentGroup}>
        {OPTIONS.map((o) => {
          const on = statuses.length === 0 || statuses.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              disabled={isPending}
              aria-pressed={on}
              className={segment(on)}
            >
              {o.label}
            </button>
          );
        })}
      </span>
    </div>
  );
}

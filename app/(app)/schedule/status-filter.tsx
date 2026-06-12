"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
}: {
  date: string;
  statuses: FlightStatus[];
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
    startTransition(() => {
      router.replace(`/schedule?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div
      role="group"
      aria-label="Status filter"
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Show
      </span>
      {OPTIONS.map((o) => {
        const on = statuses.length === 0 || statuses.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            disabled={isPending}
            aria-pressed={on}
            className={`rounded-md border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.06em] transition-colors ${
              on
                ? "border-status-blue bg-status-blue/15 text-status-blue"
                : "border-border bg-card text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

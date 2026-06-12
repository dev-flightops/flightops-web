"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DatePicker({
  defaultValue,
  statuses,
}: {
  defaultValue: string;
  statuses: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigateTo = (date: string) => {
    const params = new URLSearchParams();
    params.set("date", date);
    if (statuses) params.set("statuses", statuses);
    startTransition(() => {
      router.replace(`/schedule?${params.toString()}`, { scroll: false });
    });
  };

  const shift = (days: number) => {
    const d = new Date(defaultValue + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    navigateTo(d.toISOString().slice(0, 10));
  };

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => shift(-1)}
        disabled={isPending}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
        aria-label="Previous day"
      >
        ←
      </button>
      <input
        type="date"
        value={defaultValue}
        onChange={(e) => navigateTo(e.target.value)}
        disabled={isPending}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={isPending}
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}

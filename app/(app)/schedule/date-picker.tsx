"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DatePicker({
  defaultValue,
  statuses,
  view,
}: {
  defaultValue: string;
  statuses: string;
  /** "list" keeps the list view (#139); the default is by aircraft. */
  view?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const navigateTo = (date: string) => {
    const params = new URLSearchParams();
    params.set("date", date);
    if (statuses) params.set("statuses", statuses);
    if (view === "list") params.set("view", "list");
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
        className="btn-caps rounded-md border border-input px-2 py-1.5 text-foreground hover:bg-accent disabled:opacity-60 text-[0.72rem]"
        aria-label="Previous day"
      >
        ←
      </button>
      <input
        type="date"
        value={defaultValue}
        onChange={(e) => navigateTo(e.target.value)}
        disabled={isPending}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        disabled={isPending}
        className="btn-caps rounded-md border border-input px-2 py-1.5 text-foreground hover:bg-accent disabled:opacity-60 text-[0.72rem]"
        aria-label="Next day"
      >
        →
      </button>
    </div>
  );
}

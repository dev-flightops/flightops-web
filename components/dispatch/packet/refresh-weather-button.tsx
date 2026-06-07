"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/**
 * Refresh Weather button — triggers a server re-render of the dispatch
 * page, which re-runs the WeatherPanel fetch. If the per-kind TTL hasn't
 * elapsed, the backend serves from cache (`cache_hit: true` on each row);
 * if it has, AWC gets hit again.
 *
 * `router.refresh()` is the App Router idiom for "re-run server
 * components without changing the URL". Wrapping it in `startTransition`
 * keeps the old UI rendered until the new data arrives — no flash, no
 * scroll jump — matching the LoadFromSchedule pattern.
 *
 * Disabled when no flight is selected (no ICAOs to refresh against).
 */
export function RefreshWeatherButton({
  flightSelected,
}: {
  flightSelected: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  if (!flightSelected) {
    return (
      <button
        type="button"
        disabled
        title="Pick a scheduled flight above first"
        className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground opacity-60"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Refresh Weather
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-busy={isPending}
      title={
        isPending
          ? "Refreshing the weather panel..."
          : "Re-run METAR + TAF lookups for this flight's route"
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground hover:border-primary/30 hover:bg-primary/8 disabled:cursor-wait disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      {isPending ? "Refreshing…" : "Refresh Weather"}
    </button>
  );
}

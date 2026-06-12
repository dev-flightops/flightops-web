"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Loader2 } from "lucide-react";

/**
 * Manual refresh — forces an immediate data pull outside the 60-second
 * auto-refresh cycle. Wraps `router.refresh()` in a transition so the
 * page keeps the current render on screen while the new server data
 * loads.
 */
export function ManualRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      title="Force immediate refresh — outside the 60s cycle"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/40 disabled:opacity-60"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : (
        <span aria-hidden>↻</span>
      )}
      Refresh
    </button>
  );
}

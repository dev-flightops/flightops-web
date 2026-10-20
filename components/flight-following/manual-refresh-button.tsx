"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { buttonOutline } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

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
      className={cn(buttonOutline, "px-3 py-1.5 text-[0.68rem]")}
    >
      <RefreshGlyph spinning={isPending} />
      Refresh
    </button>
  );
}

/** Drawn (#78): an open circle with an arrowhead, turning while it works. */
function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
      className={spinning ? "animate-spin" : undefined}
    >
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" strokeLinecap="round" />
      <path d="M13.5 2.5v3.2h-3.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

import { Sparkles } from "lucide-react";

import type { FlightDetail } from "@/lib/api/types";

/**
 * Top header of the dispatch packet page — title on the left, action
 * buttons (mode toggle, AI Assistant, History) on the right.
 *
 * Matches the legacy `templates/dispatch/form.html` top row. The mode
 * toggle is context-aware: in Planning Mode (no flight, or a flight
 * that isn't releasable) it's a locked pill; once a scheduled flight
 * is selected, it becomes "Switch to Release Mode →" — an anchor that
 * scrolls to the Release section in the right column (which already
 * holds the existing release flow). Legacy uses the same label.
 */

export function PacketHeader({
  tenantName,
  flight,
}: {
  tenantName: string;
  flight?: FlightDetail | null;
}) {
  const canRelease = flight?.status === "scheduled";

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Flight Dispatch Packet
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {tenantName} · FAR 135 Dispatch Release
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canRelease ? (
          // Anchor scrolls to the existing release section in the right
          // column. The actual state mutation lives on the ReleaseButton
          // there; legacy renders the same "switch" label as a button
          // that does the same hand-off.
          <a
            href="#release-actions"
            className="inline-flex items-center gap-1 rounded-md border border-status-blue bg-status-blue/[0.08] px-3 py-1.5 text-[0.72rem] font-semibold text-status-blue hover:bg-status-blue/[0.14]"
          >
            Switch to Release Mode →
          </a>
        ) : (
          <span
            title={
              flight
                ? `This flight is ${flight.status} — nothing to release.`
                : "Pick a scheduled flight to enable release."
            }
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-[0.72rem] font-semibold text-status-blue opacity-80"
          >
            Planning Mode
          </span>
        )}

        {/* AI Assistant — disabled, M4 (ai-service). */}
        <button
          type="button"
          disabled
          title="AI Assistant · Coming in M4"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-status-purple/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-status-purple opacity-60"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          AI Assistant
        </button>

        {/* History — disabled, M3 (no dispatch-packet history table yet). */}
        <button
          type="button"
          disabled
          title="Packet history · Coming in M3"
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground opacity-60"
        >
          History
        </button>
      </div>
    </div>
  );
}

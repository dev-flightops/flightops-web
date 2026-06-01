/**
 * Top header of the dispatch packet page — title on the left, action
 * buttons (Planning Mode toggle, AI Assistant, History) on the right.
 *
 * Pixel-match for the legacy `templates/dispatch/form.html` top row
 * (lines 7-27). The three right-side actions need services we don't
 * have yet, so they render as disabled buttons with milestone tooltips
 * per project policy.
 */

export function PacketHeader({ tenantName }: { tenantName: string }) {
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
        {/* Planning Mode toggle — disabled, M3 (scenario comparison needs
            multiple services to be mockable). */}
        <label
          title="Planning Mode · Coming in M3"
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-[0.72rem] font-semibold text-status-blue opacity-60"
        >
          <input
            type="checkbox"
            disabled
            className="cursor-not-allowed"
            aria-label="Planning Mode"
          />
          Planning Mode
        </label>

        {/* AI Assistant — disabled, M4 (ai-service). */}
        <button
          type="button"
          disabled
          title="AI Assistant · Coming in M4"
          className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-status-purple/40 bg-transparent px-3 py-1.5 text-xs font-semibold text-status-purple opacity-60"
        >
          ✨ AI Assistant
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

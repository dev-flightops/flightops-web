import { SectionPanel } from "./section-panel";

/**
 * Right column of the dispatch packet form — action buttons + data
 * panels + dispatcher notes. Matches legacy
 * `templates/dispatch/form.html` lines 609-680.
 *
 * In M1 nothing on this side is interactive:
 *   - Refresh Weather → M2 weather-service
 *   - AI Review → M4 ai-service
 *   - Generate PDF → M2-M3 (needs the legality + weather data; today's
 *     /dispatch/[id]/release.pdf works per-flight from the detail page)
 *
 * Data panels are placeholders that mirror the legacy empty-state copy.
 */
export function RightColumn() {
  return (
    <div className="space-y-5">
      <SectionPanel title={null}>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled
            title="Refresh Weather · Coming in M2"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-border bg-transparent px-4 py-2 text-xs font-semibold text-foreground opacity-60"
          >
            Refresh Weather
          </button>

          <button
            type="button"
            disabled
            title="AI Review · Coming in M4"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-status-purple/40 bg-transparent px-4 py-2 text-xs font-semibold text-status-purple opacity-60"
          >
            ✨ AI Review
          </button>

          <button
            type="button"
            disabled
            title="Pick a scheduled flight above, then release it from its detail page to download the PDF"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground opacity-60"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
            Generate PDF
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Full packet generation lands once weather + legality data sources
          are wired. For now, release a scheduled flight from{" "}
          <span className="font-mono">/dispatch/&lt;id&gt;</span> to grab its
          release PDF.
        </p>
      </SectionPanel>

      <SectionPanel title="Briefing data">
        <p className="text-xs text-muted-foreground">
          When the packet is refreshed, this panel fills with weather summary,
          weight &amp; balance, performance, and risk score cards. Empty until
          the supporting services ship.
        </p>
      </SectionPanel>

      <SectionPanel title="Dispatcher Notes">
        <textarea
          rows={4}
          disabled
          placeholder="Internal notes for this packet — visible to dispatch + ops, not on the released PDF."
          className="ff-input text-sm"
        />
      </SectionPanel>
    </div>
  );
}

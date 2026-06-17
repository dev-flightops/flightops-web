import { DEMO_PIC_NAME } from "./demo-placeholders";

/**
 * Crew-status rows from the legacy `templates/dispatch/form.html`:
 *
 *   - CrewLegalityHints — two muted hint lines, each rendered as its
 *     own full-width card, sitting between the Flight Details panel
 *     and the green CLEAR banner.
 *   - CrewCurrencyBanner — the full-width green
 *     "✓ CLEAR — ALL CURRENCY ITEMS CURRENT" row with the PIC name +
 *     "100% compliant" + "View profile →" link. Placeholder copy is
 *     stamped beneath the banner because we have no crew-service yet
 *     (M3).
 *
 * Both render at all times because the legacy renders them as part of
 * the static form skeleton, not as conditional post-selection rows.
 */

export function CrewLegalityHints() {
  return (
    <div className="space-y-3">
      <div className="rounded-md bg-muted/40 px-5 py-3.5 text-xs text-muted-foreground">
        Enter PIC/SIC names above to check crew legality.
      </div>
      <div className="rounded-md bg-muted/40 px-5 py-3.5 text-xs text-muted-foreground">
        Enter N-number above to check airworthiness.
      </div>
    </div>
  );
}

export function CrewCurrencyBanner() {
  return (
    <div className="rounded-md border border-status-green/40 bg-status-green/[0.08] px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2 text-xs">
        <span className="text-base text-status-green">✓</span>
        <span className="font-bold uppercase tracking-[0.06em] text-status-green">
          Clear — all currency items current
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3 text-xs">
          <span className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            PIC
          </span>
          <span className="font-semibold text-foreground">{DEMO_PIC_NAME}</span>
          <span className="font-semibold text-status-green">100% compliant</span>
        </div>
        <button
          type="button"
          disabled
          title="Pilot profile · Coming in M3 (crew-service)"
          className="cursor-not-allowed text-xs font-semibold text-status-blue opacity-60"
        >
          View profile →
        </button>
      </div>
    </div>
  );
}

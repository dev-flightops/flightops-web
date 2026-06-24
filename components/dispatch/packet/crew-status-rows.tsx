/**
 * Crew-status hint rows from the legacy `templates/dispatch/form.html`:
 *
 *   - CrewLegalityHints — two muted hint lines, each rendered as its
 *     own full-width card, sitting between the Flight Details panel
 *     and the compliance gate.
 *
 * The previous `CrewCurrencyBanner` placeholder ("100% compliant"
 * hardcoded against the demo PIC) was replaced by the live
 * `DispatchComplianceGate` once Spec 5's `/compliance/pic-check`
 * endpoint shipped.
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

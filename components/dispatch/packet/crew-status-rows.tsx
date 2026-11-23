/**
 * Crew-status hint rows from the legacy `templates/dispatch/form.html`:
 *
 *   - CrewLegalityHints — up to two muted hint lines, each rendered as its
 *     own full-width card, sitting between the Flight Details panel
 *     and the compliance gate.
 *
 * Each line asks for what is still missing, and goes once it is there
 * (1119-15, the client's 11/19 audit: "Enter PIC/SIC names above" and
 * "Enter N-number above" stayed on screen after both were set).
 *
 * The previous `CrewCurrencyBanner` placeholder ("100% compliant"
 * hardcoded against the demo PIC) was replaced by the live
 * `DispatchComplianceGate` once Spec 5's `/compliance/pic-check`
 * endpoint shipped.
 */

export function CrewLegalityHints({
  hasPic = false,
  hasAircraft = false,
}: {
  /** A PIC is on the flight (or picked), so crew legality is checked below. */
  hasPic?: boolean;
  /** The flight has its aircraft, so airworthiness is checked below. */
  hasAircraft?: boolean;
}) {
  if (hasPic && hasAircraft) return null;
  return (
    <div className="space-y-3">
      {hasPic ? null : (
        <div className="rounded-md bg-muted/60 px-5 py-3.5 text-xs text-muted-foreground">
          Enter PIC/SIC names above to check crew legality.
        </div>
      )}
      {hasAircraft ? null : (
        <div className="rounded-md bg-muted/60 px-5 py-3.5 text-xs text-muted-foreground">
          Enter N-number above to check airworthiness.
        </div>
      )}
    </div>
  );
}

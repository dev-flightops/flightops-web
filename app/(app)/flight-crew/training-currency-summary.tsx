/**
 * Training currency summary (Spec 4 §"Page layout / Training currency summary").
 *
 * Placeholder for this PR. Spec 4 says: "All tracked Part 135 currency
 * items with color coded badges. Read only — pilots cannot edit currency
 * from this view. NON-CURRENT items show a red banner: You are non-current
 * on [item]. Contact your Chief Pilot before your next flight."
 *
 * The source of truth — Spec 5's centralized `calculate_currency_status()`
 * and `pilot_currency_records` table — doesn't exist yet. When Spec 5
 * lands, this card reads from a new `getPilotCurrencySummary()` helper
 * and renders the same color-coded badges (UPCOMING blue, EARLY MONTH
 * teal, DUE THIS MONTH green, GRACE yellow w/ days remaining, NON-CURRENT
 * red, NOT STARTED grey).
 */
export function TrainingCurrencySummary() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6">
      <p className="text-sm text-muted-foreground">
        Training currency badges land with the{" "}
        <span className="font-semibold text-foreground">
          Records &amp; Compliance
        </span>{" "}
        portal (Spec 5). Once that ships, this card lists every Part 135
        item you&apos;re tracked on with a color-coded status — Upcoming,
        Early Month, Due, Grace, Non-Current.
      </p>
      <p className="mt-3 text-xs text-muted-foreground/70">
        Have a question about your currency? Contact your Chief Pilot.
      </p>
    </div>
  );
}

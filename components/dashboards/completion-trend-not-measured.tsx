/**
 * The 8-week completion trend, as it stands: not computed.
 *
 * The Director of Operations and Ops Score views both drew it as eight
 * bars, each labelled "0%" at a 2% height, under the heading "8-Week
 * Completion Trend" with a data-source caption. An operator reading it
 * saw a completion rate of zero for two months. The Ops Score view also
 * put the day's ops score, a different figure, on the current week.
 *
 * It is the `or 0` pattern in chart form, and the same mistake the
 * reports were built to avoid: a rate of zero is a different claim
 * from a rate nobody computed. Eight weeks of 0% says the operation
 * completed no flights.
 *
 * So it says what is true. The figure is computable — PS Form 5500
 * already derives trips flown against trips scheduled per route, and
 * BI buckets flights across a trailing window — but nothing computes
 * it weekly yet, and a chart is not the place to imply otherwise.
 * Legacy draws the weekly axis anyway; this leaves it out until there
 * is a figure to put on it.
 */
export function CompletionTrendNotMeasured() {
  return (
    <div className="flex h-32 flex-col items-center justify-center gap-1.5 text-center">
      <p className="text-xs font-semibold text-muted-foreground">
        Not computed yet
      </p>
      <p className="max-w-xs text-[0.68rem] leading-relaxed text-muted-foreground">
        Weekly completion is not aggregated anywhere yet. It is
        derivable — flights flown against flights scheduled, the same
        arithmetic PS Form 5500 does per route — and this panel will
        draw it once something computes it.
      </p>
    </div>
  );
}

/**
 * Placeholder for the flight board table that ships in M2-G-11.
 *
 * Kept as its own component so M2-G-11 can replace this file in
 * isolation without touching page.tsx. The empty-state styling matches
 * the legacy board.html's "No active flights" panel — a tall card with
 * a faint plane glyph and a CTA pointing at "+ Open Flight".
 */
export function ListViewPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/40 py-20 text-center">
      <div className="mb-3 text-3xl opacity-20" aria-hidden>
        &#9992;
      </div>
      <p className="text-sm font-semibold text-muted-foreground">
        Flight board lands in M2-G-11.
      </p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground/70">
        This view will list each flight with its aircraft, route, PIC,
        ETD/ETA, status badge, and last-contact time — driven by a new
        ops endpoint filtered by the day-window tabs above.
      </p>
    </div>
  );
}

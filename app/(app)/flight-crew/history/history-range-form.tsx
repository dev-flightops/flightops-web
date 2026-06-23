/**
 * Date-range filter on the My History page. Plain GET form — no
 * JS, no server action — so a pilot can also share a filtered link
 * by copying the URL. The page reads the params on the next render.
 */

export function HistoryRangeForm({
  fromDate,
  toDate,
  tab,
}: {
  fromDate: string;
  toDate: string;
  tab: "flight" | "duty";
}) {
  return (
    <form
      method="get"
      action="/flight-crew/history"
      className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3"
    >
      {/* Preserve the tab the pilot is on. */}
      <input type="hidden" name="tab" value={tab} />
      <div>
        <label
          htmlFor="from"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          From
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={fromDate}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="to"
          className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
        >
          To
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={toDate}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-status-blue focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="rounded-md bg-status-blue px-4 py-1.5 text-xs font-semibold text-white hover:brightness-110"
      >
        Apply
      </button>
    </form>
  );
}

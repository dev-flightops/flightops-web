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
          className="field-label"
        >
          From
        </label>
        <input
          id="from"
          name="from"
          type="date"
          defaultValue={fromDate}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      </div>
      <div>
        <label
          htmlFor="to"
          className="field-label"
        >
          To
        </label>
        <input
          id="to"
          name="to"
          type="date"
          defaultValue={toDate}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="btn-caps rounded-md bg-primary px-4 py-1.5 text-white hover:bg-brand-dark text-[0.72rem]"
      >
        Apply
      </button>
    </form>
  );
}

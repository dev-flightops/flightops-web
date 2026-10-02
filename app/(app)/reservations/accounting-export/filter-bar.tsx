import Link from "next/link";

export const ACCOUNTING_EXPORT_PATH = "/reservations/accounting-export";

/**
 * Accounting Export date range, as legacy `acct_export/review.html:22-45`
 * has it: a plain GET form, so Filter puts `?start=&end=` in the URL and
 * the page reads them on the next render. A filtered view can be shared
 * by copying the link. Reset is a link to the bare URL, whose range is
 * the 1st of this month to today.
 *
 * Legacy's Customer dropdown is left out until the export carries
 * customers: today it would list customers and filter nothing.
 *
 * The inputs are uncontrolled, so the page keys this component on the
 * range: a client-side Reset then remounts it with the new defaults.
 */
export function AcctExportFilterBar({
  start,
  end,
}: {
  start: string;
  end: string;
}) {
  return (
    <form
      role="search"
      method="get"
      action={ACCOUNTING_EXPORT_PATH}
      className="mb-5 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card px-4 py-3"
    >
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">From</span>
        <input
          type="date"
          name="start"
          defaultValue={start}
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <label>
        <span className="mb-1 block text-xs text-muted-foreground">To</span>
        <input
          type="date"
          name="end"
          defaultValue={end}
          className="w-40 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </label>
      <button
        type="submit"
        className="rounded-md border border-border bg-muted/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
      >
        Filter
      </button>
      <Link
        href={ACCOUNTING_EXPORT_PATH}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Reset
      </Link>
    </form>
  );
}

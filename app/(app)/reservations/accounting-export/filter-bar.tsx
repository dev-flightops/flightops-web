export const ACCOUNTING_EXPORT_PATH = "/reservations/accounting-export";

/**
 * Accounting Export date range, as legacy `acct_export/review.html:22-45`
 * has it: a plain GET form, so Filter puts `?start=&end=` in the URL and
 * the page reads them on the next render. A filtered view can be shared
 * by copying the link.
 *
 * Reset is a plain link to the bare URL, as legacy's is (`:44`), so it
 * reloads the page. A client-side link to the URL already showing (the
 * default range) would keep dates typed but not applied. The bare URL's
 * range is the 1st of this month to today.
 *
 * The Customer dropdown is legacy's (`:30-38`): "All customers", then
 * the operator's active customers. It is left out when the customer
 * list could not be read, rather than offering a filter that lists
 * nobody.
 *
 * The inputs are uncontrolled, so the page keys this component on the
 * range: a client-side navigation to another range (the sub-nav's link
 * to the bare URL, say) remounts it with that range's dates.
 */
export type CustomerOption = { id: string; name: string };

export function AcctExportFilterBar({
  start,
  end,
  customer = "",
  customers = [],
}: {
  start: string;
  end: string;
  customer?: string;
  customers?: readonly CustomerOption[];
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
      {customers.length > 0 ? (
        <label>
          <span className="mb-1 block text-xs text-muted-foreground">Customer</span>
          <select
            name="customer"
            defaultValue={customer}
            className="w-56 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All customers</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="submit"
        className="rounded-md border border-border bg-muted/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent"
      >
        Filter
      </button>
      <a
        href={ACCOUNTING_EXPORT_PATH}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        Reset
      </a>
    </form>
  );
}

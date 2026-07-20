import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { type Customer, listCustomers } from "@/lib/api/reservations";

export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; include_archived?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const includeArchived = params.include_archived === "1";

  let customers: Customer[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const response = await listCustomers({
      q: q || undefined,
      include_archived: includeArchived,
      limit: 200,
    });
    customers = response.items;
    total = response.total;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Customer list unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Link href="/reservations" className="hover:text-foreground">
              ← Reservations
            </Link>
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Booking counterparties — individuals, companies, and agencies.
          </p>
        </div>
        <Link
          href="/reservations/customers/new"
          className="rounded-md border border-status-blue bg-status-blue/15 px-3 py-1.5 text-xs font-semibold text-status-blue hover:bg-status-blue/20"
        >
          + New Customer
        </Link>
      </header>

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, company, or email…"
          className="flex-1 min-w-0 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
        />
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="include_archived"
            value="1"
            defaultChecked={includeArchived}
          />
          Show archived
        </label>
        <button
          type="submit"
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground/80 hover:bg-muted/20"
        >
          Search
        </button>
      </form>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {q
              ? `No customers matching "${q}".`
              : "No customers yet."}
          </p>
          {!q ? (
            <p className="mt-2 text-xs text-muted-foreground/70">
              <Link
                href="/reservations/customers/new"
                className="text-status-blue hover:underline"
              >
                Create your first customer
              </Link>{" "}
              to start filing bookings.
            </p>
          ) : null}
        </div>
      ) : (
        <CustomerTable items={customers} total={total} />
      )}
    </div>
  );
}

function CustomerTable({
  items,
  total,
}: {
  items: Customer[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Company
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Contact
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Status
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((c) => (
              <tr key={c.id} className="hover:bg-muted/5">
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                  {c.full_name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.company_name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.email ?? c.phone ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {c.archived_at ? (
                    <span className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                      Archived
                    </span>
                  ) : (
                    <span className="rounded border border-status-green/40 bg-status-green/10 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-status-green">
                      Active
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/reservations/customers/${c.id}`}
                    className="text-xs font-semibold text-status-blue hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="border-t border-border px-4 py-2 text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
        {total} customer{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

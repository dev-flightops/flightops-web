import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
  type Customer,
  type CustomerType,
  listCustomers,
} from "@/lib/api/reservations";

/**
 * /customers — Customer directory (top-level route matching legacy
 * peregrineflight.com/customers/).
 *
 * Layout copies legacy pixel-close: title + type subtitle + New Customer
 * top-right + Search / Type / Filter row + empty state or table.
 */
export default async function CustomersListPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    include_archived?: string;
  }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const customerType = _validType(params.type);
  const includeArchived = params.include_archived === "1";

  let customers: Customer[] = [];
  let total = 0;
  let loadError: string | null = null;
  try {
    const response = await listCustomers({
      q: q || undefined,
      customer_type: customerType,
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
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Individual · Corporate · Government · Non-Profit
          </p>
        </div>
        <Link
          href="/customers/new"
          className="btn-caps rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark"
        >
          + New Customer
        </Link>
      </header>

      <form method="GET" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem_auto]">
        <Field label="Search">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Name, company, email…"
            className="ff-input"
          />
        </Field>
        <Field label="Type">
          <select name="type" defaultValue={customerType ?? ""} className="ff-input">
            <option value="">All types</option>
            {CUSTOMER_TYPES.map((t) => (
              <option key={t} value={t}>
                {CUSTOMER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-2">
          <label className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
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
            className="btn-caps rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent text-[0.72rem]"
          >
            Filter
          </button>
        </div>
      </form>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : customers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {q || customerType
            ? "No customers match those filters."
            : "No customers yet. Add your first one above."}
        </div>
      ) : (
        <CustomerTable items={customers} total={total} />
      )}

    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="field-label">
        {label}
      </label>
      {children}
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
          <thead className="ff-thead">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Name
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Company
              </th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                Type
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
              <tr key={c.id} className="hover:bg-accent">
                <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                  {c.full_name}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.company_name ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <CustomerTypePill type={c.customer_type} />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {c.email ?? c.phone ?? "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {c.archived_at ? (
                    <span className="eyebrow">
                      Archived
                    </span>
                  ) : (
                    <span className="status-mark text-status-green">
                      Active
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <Link
                    href={`/customers/${c.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="eyebrow border-t border-border px-4 py-2">
        {total} customer{total === 1 ? "" : "s"}
      </footer>
    </div>
  );
}

function CustomerTypePill({ type }: { type: CustomerType }) {
  const cls =
    type === "corporate"
      ? "text-status-blue"
      : type === "government"
        ? "text-status-purple"
        : type === "non_profit"
          ? "text-status-green"
          : "text-muted-foreground";
  return (
    <span
      className={
        "status-mark " +
        cls
      }
    >
      {CUSTOMER_TYPE_LABELS[type]}
    </span>
  );
}

function _validType(raw: string | undefined): CustomerType | undefined {
  if (!raw) return undefined;
  return (CUSTOMER_TYPES as readonly string[]).includes(raw)
    ? (raw as CustomerType)
    : undefined;
}

import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { ApiError } from "@/lib/api/client";
import { listPartBases, listPartCategories, listParts, type CompanyBaseOption, type PartList } from "@/lib/api/maintenance";
import { formatCost, formatQty } from "@/lib/maintenance/parts";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { BarcodeScan } from "./barcode-scan";

/**
 * /maintenance/inventory (#172), legacy's templates/maintenance/inventory.html.
 *
 * Search, base, category and low stock, then the parts. A row is stock at one
 * base (#178), and its quantity reads red at or below its minimum, counting
 * what's on its way to it, as legacy counted stock in transit. Shipping and
 * Requests are legacy's two buttons.
 */

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = one(params.q);
  const category = one(params.category);
  const base = one(params.base).toUpperCase();
  const lowStock = one(params.low_stock) === "1";
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);

  let list: PartList | null = null;
  let categories: { value: string; label: string }[] = [];
  let bases: CompanyBaseOption[] = [];
  let loadError: string | null = null;
  try {
    [list, categories, bases] = await Promise.all([
      listParts({ q, category, lowStock, base }),
      listPartCategories(),
      listPartBases().catch(() => []),
    ]);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The inventory is unavailable. Try refreshing in a moment.";
  }
  const label = (value: string) => categories.find((c) => c.value === value)?.label ?? value;
  const filtered = Boolean(q || category || lowStock || base);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Parts Inventory"
        back={{ href: "/maintenance", label: "Fleet" }}
        description={
          list ? (
            <>
              {list.total} part{list.total === 1 ? "" : "s"}
              {list.low_count > 0 ? (
                <span className="text-status-red"> · {list.low_count} low stock</span>
              ) : null}
            </>
          ) : null
        }
        actions={
          <>
            <Link href="/maintenance/shipping" className={buttonOutline}>
              Shipping
            </Link>
            <Link href="/maintenance/parts-requests" className={buttonOutline}>
              Requests
            </Link>
            <Link href="/maintenance/expiration" className={buttonOutline}>
              Expiration
            </Link>
            <Link href="/maintenance/batch-trace" className={buttonOutline}>
              Batch Trace
            </Link>
            {canEdit ? (
              <Link href="/maintenance/inventory/new" className={buttonSolid}>
                + Add Part
              </Link>
            ) : null}
          </>
        }
      />

      {canEdit ? <BarcodeScan /> : null}

      <form method="get" action="/maintenance/inventory" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="parts-q" className="field-label">
            Search
          </label>
          <input
            id="parts-q"
            name="q"
            defaultValue={q}
            placeholder="Part number or description"
            className="ff-input px-3 py-2 text-sm"
          />
        </div>
        {bases.length > 0 ? (
          <div className="min-w-[120px]">
            <label htmlFor="parts-base" className="field-label">
              Base
            </label>
            <select id="parts-base" name="base" defaultValue={base} className="ff-input px-3 py-2 text-sm">
              <option value="">All</option>
              {bases.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="min-w-[140px]">
          <label htmlFor="parts-category" className="field-label">
            Category
          </label>
          <select id="parts-category" name="category" defaultValue={category} className="ff-input px-3 py-2 text-sm">
            <option value="">All</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-xs text-muted-foreground">
          <input type="checkbox" name="low_stock" value="1" defaultChecked={lowStock} />
          Low stock only
        </label>
        <button type="submit" className={buttonOutline}>
          Filter
        </button>
      </form>

      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : list && list.items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="ff-table w-full text-sm">
            <thead className="ff-thead">
              <tr>
                <th>P/N</th>
                <th>Description</th>
                <th>Category</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Min</th>
                <th>Base</th>
                <th>Location</th>
                <th className="text-right">Unit Cost</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((part) => (
                <tr key={part.id}>
                  <td className="font-mono text-xs font-semibold">{part.part_number}</td>
                  <td>
                    {part.description}
                    {part.expired ? <span className="status-mark ml-2 text-status-red">Expired</span> : null}
                  </td>
                  <td className="text-xs text-muted-foreground">{label(part.category)}</td>
                  <td className={cn("text-right font-mono", part.low_stock && "font-bold text-status-red")}>
                    {formatQty(part.qty_on_hand)} <span className="text-xs font-normal text-muted-foreground">{part.unit}</span>
                    {part.incoming > 0 ? (
                      <span className="block text-[0.7rem] font-normal text-muted-foreground">
                        +{formatQty(part.incoming)} on the way
                      </span>
                    ) : null}
                  </td>
                  <td className="text-right font-mono text-xs text-muted-foreground">{formatQty(part.qty_minimum)}</td>
                  <td className="font-mono text-xs">{part.base ?? "—"}</td>
                  <td className="text-xs text-muted-foreground">{part.location ?? "—"}</td>
                  <td className="text-right font-mono text-xs">{formatCost(part.unit_cost)}</td>
                  <td className="text-right">
                    <Link href={`/maintenance/inventory/${part.id}`} className={linkCaps}>
                      Open<span className="sr-only"> {part.part_number}</span> <span aria-hidden>›</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          action={
            canEdit && !filtered ? (
              <Link href="/maintenance/inventory/new" className={buttonSolid}>
                Add First Part
              </Link>
            ) : undefined
          }
        >
          {filtered ? "No parts match." : "No parts in inventory yet."}
        </EmptyState>
      )}
    </div>
  );
}

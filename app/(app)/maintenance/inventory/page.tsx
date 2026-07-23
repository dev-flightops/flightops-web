import Link from "next/link";

import { InventoryFilterBar } from "./filter-bar";

/**
 * /maintenance/inventory — legacy `templates/maintenance/inventory.html`.
 *
 * Parts inventory. Right cluster: Shipping · Requests · Barcode Scan
 * · Fleet · + Add Part. Filter row: Search (P/N or description) ·
 * Category dropdown · Low-stock-only checkbox · Filter button. Table:
 * P/N · Description · Category · Qty (bold red when <= min) · Min ·
 * Location · Unit Cost · Actions.
 *
 * Backend not shipped — Marc's maintenance-service Parts endpoints
 * still to land. Filter bar state is client-local; swap to
 * `listParts({ q, category, low_stock })` once the API exists.
 */

const PART_CATEGORIES = [
  { value: "airframe", label: "Airframe" },
  { value: "engine", label: "Engine" },
  { value: "avionics", label: "Avionics" },
  { value: "landing_gear", label: "Landing Gear" },
  { value: "hydraulic", label: "Hydraulic" },
  { value: "electrical", label: "Electrical" },
  { value: "consumable", label: "Consumable" },
  { value: "hardware", label: "Hardware" },
  { value: "tool", label: "Tool" },
] as const;

const BACKEND_HINT = "Inventory ships with the maintenance-service (M2 backend)";

export default function InventoryPage() {
  const total: number = 0;
  const lowCount: number = 0;
  const pendingRequests: number = 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Parts Inventory</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total} part{total === 1 ? "" : "s"}
            {lowCount > 0 && (
              <>
                {" · "}
                <span className="text-status-red">{lowCount} below minimum</span>
              </>
            )}
            {pendingRequests > 0 && (
              <>
                {" · "}
                <span className="text-status-yellow">{pendingRequests} pending requests</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["Shipping", "Requests", "Barcode Scan"] as const).map((label) => (
            <button
              key={label}
              type="button"
              disabled
              aria-disabled="true"
              title={BACKEND_HINT}
              className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-100"
            >
              {label}
            </button>
          ))}
          <Link
            href="/maintenance"
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
          >
            Fleet
          </Link>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            + Add Part
          </button>
        </div>
      </header>

      <InventoryFilterBar categories={[...PART_CATEGORIES]} />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">P/N</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Description</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Category</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Qty</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Min</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Location</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Unit Cost</th>
                <th scope="col" className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No parts in inventory yet. Add a part to start tracking stock levels, reorder points, and installation history.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { NotBuiltPage } from "@/components/not-built-page";

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
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function InventoryPage() {
  return (
    <NotBuiltPage
      title="Parts Inventory"
      summary="Parts stock by location, with reorder points, low-stock alerts and each part's installation history."
    />
  );
}

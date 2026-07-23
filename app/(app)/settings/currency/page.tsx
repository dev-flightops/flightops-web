import Link from "next/link";

/**
 * /settings/currency — legacy `templates/currency/item_manager.html`
 * (legacy path /currency/items).
 *
 * Per-company currency item catalog. Header + New Custom Item CTA +
 * Default Training Package panel (auto-assign to new pilots) + item
 * list with per-item Edit / Deactivate / Archive. Interval types:
 * calendar month · rolling days · hard expiry · initial only. Item
 * flags: grace month · check event · examiner required · initial
 * only · aircraft-type specific.
 *
 * Backend not shipped in this route — the /compliance/crew-currency
 * page (M2-M-2/3) uses the pilot_currency_records table with 14
 * default Part 135 items, but the per-tenant catalog editor endpoints
 * are still Marc's M2 work. All CTAs disabled with milestone
 * tooltips.
 */

const BACKEND_HINT =
  "Currency-item catalog editor ships with the crew-service (M2 backend)";

export default function SettingsCurrencyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs">
        <Link href="/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="font-semibold text-status-blue">Currency</span>
      </nav>

      <header className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold">Currency Items — Manage</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Company-specific catalog. Changes apply to future calculations only —
            existing records are preserved.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/compliance/crew-currency"
            className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
          >
            ← Fleet Board
          </Link>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            + New Custom Item
          </button>
        </div>
      </header>

      <section className="mb-5 rounded-lg border border-status-blue/30 bg-status-blue/5 px-4 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Default Training Package</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              These items are automatically assigned to every new pilot.
            </p>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            Save Package
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          The 14 default Part 135 currency items ship with the{" "}
          <Link href="/compliance/crew-currency" className="text-status-blue hover:underline">
            /compliance/crew-currency
          </Link>{" "}
          board. Editing this default package requires the per-tenant catalog endpoints from Marc's M2 crew-service backend.
        </p>
      </section>

      <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        All Items (0)
      </div>
      <div className="rounded-lg border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No custom currency items yet. Use{" "}
          <Link href="/compliance/crew-currency" className="text-status-blue hover:underline">
            /compliance/crew-currency
          </Link>{" "}
          to view the 14 default Part 135 items backed by the M2 schema.
        </p>
      </div>
    </div>
  );
}

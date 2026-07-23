import Link from "next/link";

import { listCurrencyItems } from "@/lib/api/ops";
import { ApiError } from "@/lib/api/client";
import type { CurrencyItemRef } from "@/lib/api/types";

/**
 * /settings/currency — legacy `templates/currency/item_manager.html`.
 *
 * Per-tenant currency item catalog. Reads live from `/ops/currency-items`
 * (M2 backend tail — includes both the 14 Part 135 defaults with
 * tenant_id=NULL and any tenant-scoped customs). Defaults render with
 * a "DEFAULT" badge and Edit/Deactivate disabled — the endpoint
 * rejects mutations on them with 403.
 *
 * Add-item flow uses the existing `createCurrencyItem` API wrapper;
 * this page ships as a list-first view — the modal / edit-row UI
 * lands with an M3 follow-up now that the read path is live.
 */

const BACKEND_HINT_WRITE =
  "Add / Edit is next up — the read side is live against /ops/currency-items";

const INTERVAL_LABELS: Record<string, string> = {
  calendar_month: "Calendar Mo.",
  rolling_days: "Rolling Days",
  hard_expiry: "Hard Expiry",
  initial_only: "Initial Only",
};

export const dynamic = "force-dynamic";

export default async function SettingsCurrencyPage() {
  let items: CurrencyItemRef[] = [];
  let loadError: string | null = null;
  try {
    const response = await listCurrencyItems({ include_inactive: true });
    items = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "Chief Pilot or Exec Admin role required to view the currency-item catalog."
          : "Currency items unavailable. Try refreshing in a moment.";
  }

  const defaults = items.filter((i) => i.is_default);
  const customs = items.filter((i) => !i.is_default);

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
            title={BACKEND_HINT_WRITE}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            + New Custom Item
          </button>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : (
        <>
          <ItemsList
            label={`Part 135 Defaults (${defaults.length})`}
            items={defaults}
            immutable
          />
          <ItemsList
            label={`Custom Items (${customs.length})`}
            items={customs}
          />
        </>
      )}
    </div>
  );
}

function ItemsList({
  label,
  items,
  immutable,
}: {
  label: string;
  items: CurrencyItemRef[];
  immutable?: boolean;
}) {
  return (
    <section className="mb-5">
      <h2 className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </h2>
      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {immutable
              ? "The 14 Part 135 defaults seed on tenant create. If missing, run the seed script."
              : "No tenant-scoped custom items yet. Add company-specific requirements (fire drills, quarterly trainings) with + New Custom Item."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Code</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Regulation</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Interval</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Flags</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((i) => (
                  <tr key={i.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {i.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold">
                      {i.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {i.regulation || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {INTERVAL_LABELS[i.interval_type] ?? i.interval_type}
                      {i.rolling_days && ` · ${i.rolling_days}d`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <FlagPills item={i} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={
                          "rounded border px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider " +
                          (i.is_active
                            ? "border-status-green/40 bg-status-green/10 text-status-green"
                            : "border-border bg-muted/30 text-muted-foreground")
                        }
                      >
                        {i.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function FlagPills({ item }: { item: CurrencyItemRef }) {
  const pills: string[] = [];
  if (item.is_default) pills.push("Default");
  if (item.requires_examiner) pills.push("Examiner");
  if (item.is_check_event) pills.push("Check");
  if (item.is_initial_only) pills.push("Initial");
  if (pills.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {pills.map((p) => (
        <span
          key={p}
          className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

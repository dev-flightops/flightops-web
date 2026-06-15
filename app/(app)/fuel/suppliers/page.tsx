import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  listFuelSuppliers,
  listSupplierBases,
} from "@/lib/api/ground";
import type {
  FuelSupplierBaseResponse,
  FuelSupplierResponse,
} from "@/lib/api/types";

/**
 * /fuel/suppliers — Supplier directory + pricing matrix (M2-G-43).
 *
 * Read-only view of the M2-M-25c directory. Each supplier row
 * expands to its supplier×base×fuel_type pricing rows. Editing
 * suppliers + pricing rows lands in M2-G-43b — backend supports
 * everything (POST / PATCH / PUT / DELETE) but the UI for it is a
 * follow-up.
 */
export default async function FuelSuppliersPage() {
  let suppliers: FuelSupplierResponse[] = [];
  let bases: FuelSupplierBaseResponse[] = [];
  let loadError: string | null = null;

  try {
    const [s, b] = await Promise.all([
      listFuelSuppliers({ includeInactive: true }),
      listSupplierBases({ includeInactive: true }),
    ]);
    suppliers = s.items;
    bases = b.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Suppliers feed unavailable. Try refreshing in a moment.";
  }

  // Index the pricing rows so each supplier card can render its
  // own matrix without an extra lookup.
  const bySupplier = new Map<string, FuelSupplierBaseResponse[]>();
  for (const b of bases) {
    const list = bySupplier.get(b.supplier_id) ?? [];
    list.push(b);
    bySupplier.set(b.supplier_id, list);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/fuel"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            ← Fuel
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Suppliers & Pricing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vendor directory with contract pricing per base + fuel type
          </p>
        </div>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No suppliers configured yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Adding suppliers from the UI lands in M2-G-43b. Use the API for
            now: <code>POST /ground/fuel/suppliers</code>.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              pricing={bySupplier.get(s.id) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierCard({
  supplier,
  pricing,
}: {
  supplier: FuelSupplierResponse;
  pricing: FuelSupplierBaseResponse[];
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {supplier.name}
            {!supplier.is_active && (
              <span className="ml-2 rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.6rem] font-semibold uppercase text-muted-foreground">
                Inactive
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[supplier.contact_name, supplier.email, supplier.phone]
              .filter(Boolean)
              .join(" · ") || "no contact on file"}
          </p>
        </div>
        {supplier.billing_terms && (
          <span className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
            {supplier.billing_terms}
          </span>
        )}
      </header>

      {pricing.length === 0 ? (
        <p className="rounded-md border border-dashed border-border bg-card/40 px-3 py-3 text-xs text-muted-foreground">
          No pricing rows configured for this supplier.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">Fuel</th>
                <th className="px-3 py-2 text-right">Price / gal</th>
                <th className="px-3 py-2">Contract</th>
                <th className="px-3 py-2">Effective</th>
                <th className="px-3 py-2">Default</th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 font-mono text-foreground">
                    {p.base_code}
                  </td>
                  <td className="px-3 py-2 text-foreground">
                    {p.fuel_type_label}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-foreground">
                    {p.price_per_gallon !== null
                      ? `$${p.price_per_gallon.toFixed(2)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.is_contract_rate ? "✓" : "spot"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {p.effective_from ?? "—"}
                    {p.effective_to ? ` → ${p.effective_to}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {p.is_default && (
                      <span className="rounded-md border border-status-blue/40 bg-status-blue/10 px-2 py-0.5 text-[0.6rem] font-semibold text-status-blue">
                        Default
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

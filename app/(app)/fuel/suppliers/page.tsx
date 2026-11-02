import Link from "next/link";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { Panel } from "@/components/ff/panel";
import { SupplierForm, SupplierHeader } from "@/components/fuel/supplier-form";
import { SupplierLogins } from "@/components/fuel/supplier-logins";
import { SupplierPrices, type PriceFuelType, type PriceStation } from "@/components/fuel/supplier-prices";
import { listSupplierLogins, type SupplierLogin } from "@/lib/api/auth";
import { FUEL_CONFIG, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/client";
import {
  listFuelSuppliers,
  listFuelTypes,
  listStations,
  listSupplierBases,
} from "@/lib/api/ground";
import type {
  FuelSupplierBaseResponse,
  FuelSupplierResponse,
} from "@/lib/api/types";

/**
 * /fuel/suppliers — Supplier directory + pricing matrix (M2-G-43).
 *
 * Each supplier with its prices, one per fuel at a base. The directory's
 * keepers (FUEL_CONFIG) add and edit suppliers, set and switch off their
 * prices, and give each its portal logins (#134): it could only be changed
 * through the API, as legacy's Fuel → Suppliers changed it.
 */
export default async function FuelSuppliersPage() {
  const canKeep = hasAnyRole((await auth())?.roles ?? [], FUEL_CONFIG);
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

  // One read per supplier; a directory holds a handful.
  const logins = new Map<string, SupplierLogin[] | null>();
  // What a price can be set for: the company's stations (null when they
  // couldn't be read, so the base is typed) and the fuels switched on.
  let stations: PriceStation[] | null = null;
  let fuelTypes: PriceFuelType[] = [];
  if (canKeep) {
    await Promise.all([
      ...suppliers.map(async (s) => {
        logins.set(s.id, await listSupplierLogins(s.id).then((r) => r.items, () => null));
      }),
      listStations().then(
        (r) => {
          stations = r.items
            .map((st) => ({ code: st.icao_code.toUpperCase(), name: st.name }))
            .sort((a, b) => a.code.localeCompare(b.code));
        },
        () => {},
      ),
      listFuelTypes().then(
        (r) => {
          fuelTypes = r.items.map((t) => ({ id: t.id, label: t.label }));
        },
        () => {},
      ),
    ]);
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <Link
            href="/fuel"
            className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-2")}
          >
            <span aria-hidden>‹</span> Fuel
          </Link>
          <h1 className="page-title">
            Suppliers & Pricing
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No suppliers configured yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canKeep
              ? "Add the first one below."
              : "The Chief Pilot, the Director of Maintenance, the Director of Operations or an Exec Admin adds them."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {suppliers.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              pricing={bySupplier.get(s.id) ?? []}
              canKeep={canKeep}
              stations={stations}
              fuelTypes={fuelTypes}
              logins={canKeep ? (logins.get(s.id) ?? null) : undefined}
            />
          ))}
        </div>
      )}

      {canKeep && !loadError ? (
        <Panel title="Add a supplier" className="mt-6">
          <SupplierForm />
        </Panel>
      ) : null}
    </div>
  );
}

function SupplierCard({
  supplier,
  pricing,
  canKeep,
  stations,
  fuelTypes,
  logins,
}: {
  supplier: FuelSupplierResponse;
  pricing: FuelSupplierBaseResponse[];
  /** Whoever keeps the directory edits the supplier and its prices. */
  canKeep: boolean;
  stations: PriceStation[] | null;
  fuelTypes: PriceFuelType[];
  /** Left out for those who don't keep the directory. */
  logins?: SupplierLogin[] | null;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4">
      <SupplierHeader supplier={supplier} canEdit={canKeep} />

      <SupplierPrices
        supplierId={supplier.id}
        supplierName={supplier.name}
        rows={pricing}
        canEdit={canKeep}
        stations={stations}
        fuelTypes={fuelTypes}
      />

      {logins !== undefined ? (
        <SupplierLogins supplierId={supplier.id} supplierName={supplier.name} logins={logins} />
      ) : null}
    </article>
  );
}

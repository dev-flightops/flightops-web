"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  savePriceAction,
  setPriceActiveAction,
  type DirectoryResult,
} from "@/app/(app)/fuel/suppliers/directory-actions";
import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { FuelSupplierBaseResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const CHECKBOX = "h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary";

const dollars = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export interface PriceStation {
  code: string;
  name: string;
}

export interface PriceFuelType {
  id: string;
  label: string;
}

/**
 * A supplier's prices: one row per fuel at a base (#134). Everyone who
 * reads the directory sees them; its keepers set a price, change one and
 * switch one off and on, as legacy's Assign Base did. Saving the same base
 * and fuel again replaces its price; a fuel order keeps the price it was
 * ordered at.
 */
export function SupplierPrices({
  supplierId,
  supplierName,
  rows,
  canEdit,
  stations,
  fuelTypes,
}: {
  supplierId: string;
  supplierName: string;
  rows: FuelSupplierBaseResponse[];
  canEdit: boolean;
  /**
   * The company's stations to price at; null when they couldn't be read.
   * Without any the base is typed, as on a fuel order.
   */
  stations: PriceStation[] | null;
  /** Active fuel types. */
  fuelTypes: PriceFuelType[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /** The row being changed, or "new", or null with the form closed. */
  const [editing, setEditing] = useState<FuelSupplierBaseResponse | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<DirectoryResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const result = await action();
      if (result.ok) {
        after?.();
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  };

  const row = editing !== "new" ? editing : null;

  return (
    <section aria-label={`Prices from ${supplierName}`}>
      {rows.length === 0 ? (
        <p className="notice notice-gray text-muted-foreground">No prices set for this supplier yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-background/40 text-left eyebrow">
                <th className="px-3 py-2">Base</th>
                <th className="px-3 py-2">Fuel</th>
                <th className="px-3 py-2 text-right">Price / gal</th>
                <th className="px-3 py-2">Contract</th>
                <th className="px-3 py-2">Effective</th>
                <th className="px-3 py-2">Default</th>
                <th className="px-3 py-2">Status</th>
                {canEdit ? <th className="px-3 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className={cn("border-b border-border last:border-0", !p.is_active && "text-muted-foreground")}>
                  <td className="px-3 py-2 font-mono">{p.base_code}</td>
                  <td className="px-3 py-2">{p.fuel_type_label}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    {p.price_per_gallon !== null ? dollars.format(p.price_per_gallon) : "—"}
                  </td>
                  <td className="px-3 py-2">{p.is_contract_rate ? "Contract" : "Spot"}</td>
                  <td className="px-3 py-2">
                    {p.effective_from ?? "—"}
                    {p.effective_to ? ` → ${p.effective_to}` : ""}
                  </td>
                  <td className="px-3 py-2">{p.is_default ? <span className="eyebrow">Default</span> : null}</td>
                  <td className="px-3 py-2">{p.is_active ? "Active" : "Off"}</td>
                  {canEdit ? (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className={buttonOutline}
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setEditing(p);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={buttonOutline}
                          disabled={pending}
                          onClick={() => run(() => setPriceActiveAction(supplierId, p, !p.is_active))}
                        >
                          {p.is_active ? "Switch off" : "Switch on"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && editing === null ? (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            className={buttonOutline}
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
          >
            + Set a price
          </button>
        </div>
      ) : null}

      {canEdit && editing !== null ? (
        fuelTypes.length === 0 && !row ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No fuel types are switched on.{" "}
            <Link href="/fuel/types" className={linkCaps}>
              Fuel Types ›
            </Link>
          </p>
        ) : (
          <form
            method="post"
            key={row?.id ?? "new"}
            aria-label={row ? `Price for ${row.fuel_type_label} at ${row.base_code}` : `Set a price from ${supplierName}`}
            className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              const text = (key: string) => String(data.get(key) ?? "");
              run(
                () =>
                  savePriceAction(supplierId, {
                    base_code: row ? row.base_code : text("base_code"),
                    fuel_type_id: row ? row.fuel_type_id : text("fuel_type_id"),
                    price_per_gallon: text("price_per_gallon"),
                    effective_from: text("effective_from"),
                    effective_to: text("effective_to"),
                    notes: text("notes"),
                    is_contract_rate: data.get("is_contract_rate") === "on",
                    is_default: data.get("is_default") === "on",
                  }),
                () => setEditing(null),
              );
            }}
          >
            {row ? (
              <p className="text-sm sm:col-span-4">
                {row.fuel_type_label} at <span className="font-mono">{row.base_code}</span>
              </p>
            ) : (
              <>
                <label>
                  <span className="field-label">Base</span>
                  {stations?.length ? (
                    <select name="base_code" required defaultValue="" className="ff-input">
                      <option value="" disabled>
                        Pick a base
                      </option>
                      {stations.map((s) => (
                        <option key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="base_code"
                      required
                      maxLength={10}
                      pattern="[A-Za-z0-9]{2,10}"
                      placeholder="ICAO, e.g. PABE"
                      className="ff-input font-mono uppercase"
                    />
                  )}
                </label>
                <label>
                  <span className="field-label">Fuel</span>
                  <select name="fuel_type_id" required defaultValue="" className="ff-input">
                    <option value="" disabled>
                      Pick a fuel
                    </option>
                    {fuelTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              <span className="field-label">Price / gal ($)</span>
              <input
                name="price_per_gallon"
                type="number"
                min={0}
                step={0.001}
                inputMode="decimal"
                defaultValue={row?.price_per_gallon ?? ""}
                className="ff-input text-right font-mono"
              />
            </label>
            <div className="flex flex-col justify-end gap-1 text-sm">
              <label className="flex items-center gap-2">
                <input name="is_contract_rate" type="checkbox" defaultChecked={row?.is_contract_rate ?? false} className={CHECKBOX} />
                Contract rate
              </label>
              <label className="flex items-center gap-2">
                <input name="is_default" type="checkbox" defaultChecked={row?.is_default ?? false} className={CHECKBOX} />
                Default for this fuel here
              </label>
            </div>
            <label>
              <span className="field-label">Effective from</span>
              <input name="effective_from" type="date" defaultValue={row?.effective_from ?? ""} className="ff-input" />
            </label>
            <label>
              <span className="field-label">Effective to</span>
              <input name="effective_to" type="date" defaultValue={row?.effective_to ?? ""} className="ff-input" />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Notes</span>
              <input name="notes" defaultValue={row?.notes ?? ""} className="ff-input" />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-4">
              Saving a base and fuel this supplier already has replaces that price. The default is the supplier
              offered first on fuel orders for this fuel at this base; setting it here takes it from any other
              supplier. Orders keep the price they were placed at.
            </p>
            <div className="flex justify-end gap-2 sm:col-span-4">
              <button type="button" className={buttonOutline} onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className={buttonSolid} disabled={pending}>
                {pending ? "Saving…" : "Save price"}
              </button>
            </div>
          </form>
        )
      ) : null}

      {error ? (
        <p role="alert" className="field-error mt-2">
          {error}
        </p>
      ) : null}
    </section>
  );
}

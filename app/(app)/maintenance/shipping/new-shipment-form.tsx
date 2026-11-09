"use client";

import { useActionState, useState } from "react";

import { buttonSolid, segment, segmentGroup } from "@/components/ff/controls";
import type { CompanyBaseOption } from "@/lib/api/maintenance";

import { createShipmentAction, type ShipmentFormState } from "./actions";

export type StockOption = { id: string; label: string; base: string | null };

/**
 * Enter a shipment (#178), legacy's form on shipping.html. Between bases, pick
 * the stock it's leaving and where it's going: its quantity comes off that
 * row now. From a vendor, pick the stock it's for: it's received there on
 * arrival.
 */
export function NewShipmentForm({
  stock,
  bases,
  vendors,
  today,
  defaultPartId,
}: {
  stock: StockOption[];
  bases: CompanyBaseOption[];
  vendors: { value: string; label: string }[];
  today: string;
  defaultPartId?: string;
}) {
  const [state, action, pending] = useActionState<ShipmentFormState, FormData>(createShipmentAction, { status: "idle" });
  const [kind, setKind] = useState<"transfer" | "vendor">("transfer");
  const errors = state.status === "field-errors" ? state.errors : {};
  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="field-error">
        {errors[name]}
      </p>
    ) : null;
  const choices = kind === "transfer" ? stock.filter((s) => s.base) : stock;

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="New shipment">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="section-title">New Shipment</h2>
        <div role="radiogroup" aria-label="Kind" className={segmentGroup}>
          {(
            [
              ["transfer", "Between bases"],
              ["vendor", "From a vendor"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={kind === value}
              onClick={() => setKind(value)}
              className={segment(kind === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="kind" value={kind} />
      {state.status === "api-error" ? (
        <p role="alert" className="notice notice-red">
          {state.message}
        </p>
      ) : state.status === "saved" ? (
        <p role="status" className="notice notice-green">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <div>
          <label htmlFor="ship-part" className="field-label">
            {kind === "transfer" ? "Stock It's Leaving" : "Stock It's For"}
            <span className="text-status-red"> *</span>
          </label>
          <select id="ship-part" name="part_id" defaultValue={defaultPartId ?? ""} key={kind} className="ff-input px-3 py-2 text-sm">
            <option value="">Pick the part</option>
            {choices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {kind === "transfer" && choices.length < stock.length ? (
            <p className="mt-1 text-xs text-muted-foreground">Stock with no base set in Inventory can&apos;t ship between bases.</p>
          ) : null}
          {error("part_id")}
        </div>
        <div>
          <label htmlFor="ship-qty" className="field-label">
            Quantity<span className="text-status-red"> *</span>
          </label>
          <input id="ship-qty" name="quantity" inputMode="decimal" defaultValue="1" className="ff-input px-3 py-2 text-sm" />
          {error("quantity")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {kind === "transfer" ? (
          <div>
            <label htmlFor="ship-dest" className="field-label">
              To Base<span className="text-status-red"> *</span>
            </label>
            {bases.length > 0 ? (
              <select id="ship-dest" name="dest_base" defaultValue="" className="ff-input px-3 py-2 text-sm">
                <option value="">Pick the base</option>
                {bases.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.code} · {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input id="ship-dest" name="dest_base" maxLength={10} placeholder="PABE" className="ff-input px-3 py-2 text-sm uppercase" />
            )}
            {error("dest_base")}
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="ship-vendor" className="field-label">
                Vendor<span className="text-status-red"> *</span>
              </label>
              <select id="ship-vendor" name="vendor_id" defaultValue="" className="ff-input px-3 py-2 text-sm">
                <option value="">Pick the vendor</option>
                {vendors.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
              {error("vendor_id")}
            </div>
            <div>
              <label htmlFor="ship-status" className="field-label">
                Status
              </label>
              <select id="ship-status" name="status" defaultValue="ordered" className="ff-input px-3 py-2 text-sm">
                <option value="ordered">Ordered</option>
                <option value="shipped">Shipped</option>
              </select>
            </div>
          </>
        )}
        <div>
          <label htmlFor="ship-awb" className="field-label">
            Airway Bill
          </label>
          <input id="ship-awb" name="airway_bill" maxLength={100} className="ff-input px-3 py-2 font-mono text-sm" />
        </div>
        <div>
          <label htmlFor="ship-carrier" className="field-label">
            Carrier
          </label>
          <input id="ship-carrier" name="carrier" maxLength={200} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="ship-date" className="field-label">
            Ship Date
          </label>
          <input id="ship-date" name="shipped_on" type="date" max={today} defaultValue={kind === "transfer" ? today : ""} key={`d-${kind}`} className="ff-input px-3 py-2 text-sm" />
          {error("shipped_on")}
        </div>
        <div>
          <label htmlFor="ship-eta" className="field-label">
            Expected Arrival
          </label>
          <input id="ship-eta" name="est_arrival_on" type="date" className="ff-input px-3 py-2 text-sm" />
          {error("est_arrival_on")}
        </div>
      </div>
      <div>
        <label htmlFor="ship-notes" className="field-label">
          Notes
        </label>
        <textarea id="ship-notes" name="notes" rows={2} className="ff-input px-3 py-2 text-sm" />
      </div>
      <button type="submit" disabled={pending} className={buttonSolid}>
        {kind === "transfer" ? "Ship It" : "Enter Order"}
      </button>
    </form>
  );
}

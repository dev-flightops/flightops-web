"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { Part } from "@/lib/api/maintenance";

import { createPartAction, removePartAction, updatePartAction, type PartFormState } from "./actions";

/**
 * Add or edit a part (#172), legacy's part_form.html. Changing the quantity on
 * an existing part counts as a stock count, and the form says so: it goes in
 * the part's history.
 */
export function PartForm({
  part,
  categories,
}: {
  part: Part | null;
  categories: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<PartFormState, FormData>(
    part ? updatePartAction.bind(null, part.id) : createPartAction,
    { status: "idle" },
  );
  const errors = state.status === "field-errors" ? state.errors : {};
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`part-${name}`} className="field-label">
        {label}
        {props.required ? <span className="text-status-red"> *</span> : null}
      </label>
      <input
        id={`part-${name}`}
        name={name}
        aria-invalid={errors[name] ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm"
        {...props}
      />
      {errors[name] ? (
        <p role="alert" className="field-error">
          {errors[name]}
        </p>
      ) : null}
    </div>
  );

  return (
    <form action={action} className="space-y-4">
      {state.status === "api-error" ? (
        <p role="alert" className="notice notice-red">
          {state.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {field("part_number", "Part Number", { required: true, maxLength: 100, defaultValue: part?.part_number ?? "" })}
        <div>
          <label htmlFor="part-category" className="field-label">
            Category
          </label>
          <select id="part-category" name="category" defaultValue={part?.category ?? "consumable"} className="ff-input px-3 py-2 text-sm">
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {field("description", "Description", { required: true, maxLength: 500, defaultValue: part?.description ?? "" })}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("manufacturer", "Manufacturer", { maxLength: 200, defaultValue: part?.manufacturer ?? "" })}
        {field("unit_cost", "Unit Cost", { inputMode: "decimal", defaultValue: part?.unit_cost ?? "" })}
        {field("unit", "Unit", { required: true, maxLength: 20, defaultValue: part?.unit ?? "EA" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("qty_on_hand", "Qty On Hand", { inputMode: "decimal", defaultValue: part?.qty_on_hand ?? "0" })}
        {field("qty_minimum", "Minimum Stock", { inputMode: "decimal", defaultValue: part?.qty_minimum ?? "0" })}
        {field("location", "Location / Bin", { maxLength: 100, defaultValue: part?.location ?? "" })}
      </div>
      {part ? (
        <p className="text-xs text-muted-foreground">
          A changed quantity is recorded in the part&apos;s history as a stock count. To record parts going on
          an aircraft or coming in, use Move stock on the part&apos;s page.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {field("shelf_life_months", "Shelf Life (months)", { inputMode: "numeric", defaultValue: part?.shelf_life_months ?? "" })}
        {field("expiration_date", "Expiration Date", { type: "date", defaultValue: part?.expiration_date ?? "" })}
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="is_life_limited" value="1" defaultChecked={part?.is_life_limited ?? false} />
          Life Limited
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("batch_number", "Batch Number", { maxLength: 100, defaultValue: part?.batch_number ?? "" })}
        {field("lot_number", "Lot Number", { maxLength: 100, defaultValue: part?.lot_number ?? "" })}
        {field("received_date", "Received Date", { type: "date", defaultValue: part?.received_date ?? "" })}
      </div>
      <div>
        <label htmlFor="part-notes" className="field-label">
          Notes
        </label>
        <textarea id="part-notes" name="notes" rows={2} defaultValue={part?.notes ?? ""} className="ff-input px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {part ? "Save" : "Add Part"}
        </button>
        <Link href={part ? `/maintenance/inventory/${part.id}` : "/maintenance/inventory"} className={buttonOutline}>
          Cancel
        </Link>
        {part ? (
          <button
            type="button"
            disabled={removing}
            className={`${buttonOutline} ml-auto text-status-red`}
            onClick={() => {
              if (!window.confirm(`Take ${part.part_number} off the inventory? Its history stays.`)) return;
              setRemoveError(null);
              startRemove(async () => {
                const result = await removePartAction(part.id);
                if (result && !result.ok) setRemoveError(result.message);
              });
            }}
          >
            Remove
          </button>
        ) : null}
      </div>
      {removeError ? (
        <p role="alert" className="text-sm text-status-red">
          {removeError}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";

import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { MxVendor } from "@/lib/api/mx-vendors";

import { createVendorAction, removeVendorAction, updateVendorAction, type VendorFormState } from "./actions";

/** Add or edit a vendor (#178), legacy's vendor_form.html. */
export function VendorForm({
  vendor,
  types,
}: {
  vendor: MxVendor | null;
  types: { value: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<VendorFormState, FormData>(
    vendor ? updateVendorAction.bind(null, vendor.id) : createVendorAction,
    { status: "idle" },
  );
  const errors = state.status === "field-errors" ? state.errors : {};
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`vendor-${name}`} className="field-label">
        {label}
        {props.required ? <span className="text-status-red"> *</span> : null}
      </label>
      <input
        id={`vendor-${name}`}
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
        {field("name", "Name", { required: true, maxLength: 300, defaultValue: vendor?.name ?? "" })}
        <div>
          <label htmlFor="vendor-vendor_type" className="field-label">
            Type
          </label>
          <select
            id="vendor-vendor_type"
            name="vendor_type"
            defaultValue={vendor?.vendor_type ?? "mro"}
            className="ff-input px-3 py-2 text-sm"
          >
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("contact_name", "Contact", { maxLength: 200, defaultValue: vendor?.contact_name ?? "" })}
        {field("phone", "Phone", { type: "tel", maxLength: 50, defaultValue: vendor?.phone ?? "" })}
        {field("email", "Email", { type: "email", maxLength: 200, defaultValue: vendor?.email ?? "" })}
      </div>
      {field("faa_cert", "FAA Certificate", {
        maxLength: 100,
        placeholder: "Repair station number",
        defaultValue: vendor?.faa_cert ?? "",
      })}
      <div>
        <label htmlFor="vendor-address" className="field-label">
          Address
        </label>
        <textarea id="vendor-address" name="address" rows={2} defaultValue={vendor?.address ?? ""} className="ff-input px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="vendor-notes" className="field-label">
          Notes
        </label>
        <textarea id="vendor-notes" name="notes" rows={2} defaultValue={vendor?.notes ?? ""} className="ff-input px-3 py-2 text-sm" />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className={buttonSolid}>
          {vendor ? "Save" : "Add Vendor"}
        </button>
        <Link href="/maintenance/vendors" className={buttonOutline}>
          Cancel
        </Link>
        {vendor ? (
          <button
            type="button"
            disabled={removing}
            className={`${buttonOutline} ml-auto text-status-red`}
            onClick={() => {
              if (!window.confirm(`Take ${vendor.name} off the vendor list? Inspections and shipments that name it keep the name.`)) return;
              setRemoveError(null);
              startRemove(async () => {
                const result = await removeVendorAction(vendor.id);
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

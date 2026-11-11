"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addSupplierAction,
  updateSupplierAction,
  type SupplierFields,
} from "@/app/(app)/fuel/suppliers/directory-actions";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import type { FuelSupplierResponse } from "@/lib/api/types";

const CHECKBOX = "h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary";

const FIELDS: (keyof SupplierFields)[] = [
  "name",
  "contact_name",
  "phone",
  "sms_phone",
  "email",
  "cc_emails",
  "account_number",
  "billing_terms",
  "notes",
  "fueled_by",
];

/**
 * A supplier's details (#134), as legacy's Add Supplier and Edit forms
 * had them. Given a supplier it edits it, with its Active switch; every
 * field is saved, so one emptied is cleared.
 */
export function SupplierForm({
  supplier,
  onDone,
}: {
  supplier?: FuelSupplierResponse;
  /** Called once the edit is saved, or on Cancel. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const value = (key: keyof SupplierFields) => supplier?.[key] ?? "";

  return (
    <form
      method="post"
      aria-label={supplier ? `Edit ${supplier.name}` : "Add a supplier"}
      className="grid gap-3 sm:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const fields = Object.fromEntries(FIELDS.map((k) => [k, String(data.get(k) ?? "")])) as SupplierFields;
        setError(null);
        setAdded(null);
        start(async () => {
          const result = supplier
            ? await updateSupplierAction(supplier.id, fields, data.get("is_active") === "on")
            : await addSupplierAction(fields);
          if (!result.ok) {
            setError(result.error ?? "Something went wrong.");
            return;
          }
          router.refresh();
          if (supplier) {
            onDone?.();
          } else {
            form.reset();
            setAdded(`${fields.name.trim()} is in the directory. Set its prices on its card above.`);
          }
        });
      }}
    >
      <label className="sm:col-span-2">
        <span className="field-label">Name</span>
        <input name="name" required maxLength={300} defaultValue={value("name")} className="ff-input" />
      </label>
      <label>
        <span className="field-label">Account #</span>
        <input name="account_number" maxLength={100} defaultValue={value("account_number")} className="ff-input" />
      </label>
      <label>
        <span className="field-label">Contact</span>
        <input name="contact_name" maxLength={200} defaultValue={value("contact_name")} className="ff-input" />
      </label>
      <label>
        <span className="field-label">Phone</span>
        <input name="phone" type="tel" maxLength={50} defaultValue={value("phone")} className="ff-input" />
      </label>
      <label>
        <span className="field-label">SMS phone</span>
        <input name="sms_phone" type="tel" maxLength={50} defaultValue={value("sms_phone")} className="ff-input" />
      </label>
      <label className="sm:col-span-2">
        <span className="field-label">Email</span>
        <input name="email" type="email" maxLength={200} defaultValue={value("email")} className="ff-input" />
      </label>
      <label>
        <span className="field-label">Billing terms</span>
        <input name="billing_terms" maxLength={200} placeholder="Net 30" defaultValue={value("billing_terms")} className="ff-input" />
      </label>
      <label className="sm:col-span-3">
        <span className="field-label">CC emails</span>
        <input
          name="cc_emails"
          placeholder="Separated by commas"
          defaultValue={value("cc_emails")}
          className="ff-input"
        />
      </label>
      <label className="sm:col-span-3">
        <span className="field-label">Who fuels</span>
        <select name="fueled_by" defaultValue={supplier?.fueled_by ?? "own_staff"} className="ff-input">
          <option value="own_staff">Our ramp: we confirm and fuel its orders</option>
          <option value="supplier">The supplier: its orders go to its portal, off the ramp&rsquo;s list</option>
        </select>
      </label>
      <label className="sm:col-span-3">
        <span className="field-label">Notes</span>
        <textarea name="notes" rows={2} defaultValue={value("notes")} className="ff-input" />
      </label>
      {supplier ? (
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input name="is_active" type="checkbox" defaultChecked={supplier.is_active} className={CHECKBOX} />
          Active: offered on fuel orders
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="field-error sm:col-span-3">
          {error}
        </p>
      ) : null}
      {added ? (
        <p role="status" className="text-sm text-foreground sm:col-span-3">
          {added}
        </p>
      ) : null}
      <div className="flex justify-end gap-2 sm:col-span-3">
        {onDone ? (
          <button type="button" className={buttonOutline} onClick={onDone}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
        </button>
      </div>
    </form>
  );
}

/** A supplier card's header; for the directory's keepers, its Edit button
 *  and the form it opens under the header. */
export function SupplierHeader({ supplier, canEdit }: { supplier: FuelSupplierResponse; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {supplier.name}
            {!supplier.is_active && <span className="ml-2 eyebrow">Inactive</span>}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[supplier.contact_name, supplier.email, supplier.phone].filter(Boolean).join(" · ") ||
              "no contact on file"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {supplier.fueled_by === "supplier" && <span className="eyebrow">Fuels its own orders</span>}
          {supplier.billing_terms && <span className="eyebrow">{supplier.billing_terms}</span>}
          {canEdit && !open ? (
            <button type="button" className={buttonOutline} onClick={() => setOpen(true)}>
              Edit
            </button>
          ) : null}
        </div>
      </header>
      {open ? (
        <div className="mt-3 border-t border-border pt-3">
          <SupplierForm supplier={supplier} onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";

import { buttonOutline, buttonSolid, linkCaps } from "@/components/ff/controls";
import type { Collector } from "@/lib/api/drug-alcohol";
import { COLLECTOR_KINDS } from "@/lib/drug-alcohol/options";

import { saveCollectorAction } from "../actions";

/** A collection site, MRO, lab or consortium, added or changed: legacy's
 *  collectors edit row. Switched off, it stays on the tests that name it
 *  and isn't offered for new ones. */
export function CollectorForm({ collector }: { collector?: Collector }) {
  const [open, setOpen] = useState(!collector);
  const blank = {
    kind: "collection_site",
    name: "",
    address: "",
    contact_name: "",
    phone: "",
    after_hours_phone: "",
    email: "",
    notes: "",
  };
  const [values, setValues] = useState<Record<string, string>>(
    collector
      ? Object.fromEntries(Object.keys(blank).map((k) => [k, String(collector[k as keyof Collector] ?? "")]))
      : blank,
  );
  const [active, setActive] = useState(collector?.is_active ?? true);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prefix = collector ? `collector-${collector.id}` : "collector-new";
  const set = (name: string) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value }));

  if (!open) {
    return (
      <button type="button" className={linkCaps} onClick={() => setOpen(true)}>
        Edit<span className="sr-only"> {collector?.name}</span>
      </button>
    );
  }

  const field = (name: string, label: string, props: { type?: string; wide?: boolean; required?: boolean } = {}) => (
    <div className={props.wide ? "sm:col-span-2" : undefined}>
      <label htmlFor={`${prefix}-${name}`} className="field-label">
        {label}
        {props.required ? <span className="text-status-red"> *</span> : null}
      </label>
      <input
        id={`${prefix}-${name}`}
        type={props.type ?? "text"}
        value={values[name] ?? ""}
        onChange={set(name)}
        className="ff-input w-full px-3 py-2 text-sm"
      />
    </div>
  );

  return (
    <form
      method="post"
      aria-label={collector ? `Edit ${collector.name}` : "Add a collector"}
      className="space-y-4 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setMessage(null);
          const result = await saveCollectorAction(collector?.id ?? null, { ...values, is_active: active });
          if (!result.ok) setMessage(result.message);
          else if (collector) setOpen(false);
          else setValues(blank);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor={`${prefix}-kind`} className="field-label">
            What It Is<span className="text-status-red"> *</span>
          </label>
          <select id={`${prefix}-kind`} value={values.kind} onChange={set("kind")} className="ff-input w-full px-3 py-2 text-sm">
            {COLLECTOR_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        {field("name", "Name", { wide: true, required: true })}
        {field("address", "Address", { wide: true })}
        {field("contact_name", "Contact")}
        {field("phone", "Phone", { type: "tel" })}
        {field("after_hours_phone", "After Hours", { type: "tel" })}
        {field("email", "Email", { type: "email" })}
        {field("notes", "Notes", { wide: true })}
        {collector ? (
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            In use
          </label>
        ) : null}
      </div>
      {message ? (
        <p role="alert" className="field-error">
          {message}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {collector ? (
          <button type="button" className={buttonOutline} onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className={buttonSolid} disabled={pending}>
          {pending ? "Saving…" : collector ? "Save" : "Add"}
        </button>
      </div>
    </form>
  );
}

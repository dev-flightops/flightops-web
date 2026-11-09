"use client";

import { useActionState } from "react";

import { buttonSolid } from "@/components/ff/controls";
import type { CompanyBaseOption } from "@/lib/api/maintenance";

import { createRequestAction, type RequestFormState } from "./actions";

/**
 * Ask another base for a part (#178), legacy's "Request Part from Another
 * Base". The stock picked says which base would send it.
 */
export function NewRequestForm({
  stock,
  bases,
  defaultPartId,
}: {
  stock: { id: string; label: string }[];
  bases: CompanyBaseOption[];
  defaultPartId?: string;
}) {
  const [state, action, pending] = useActionState<RequestFormState, FormData>(createRequestAction, { status: "idle" });
  const errors = state.status === "field-errors" ? state.errors : {};
  const error = (name: string) =>
    errors[name] ? (
      <p role="alert" className="field-error">
        {errors[name]}
      </p>
    ) : null;

  return (
    <form action={action} className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="New parts request">
      <h2 className="section-title">Request a Part from Another Base</h2>
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
          <label htmlFor="req-part" className="field-label">
            Stock<span className="text-status-red"> *</span>
          </label>
          <select id="req-part" name="part_id" defaultValue={defaultPartId ?? ""} className="ff-input px-3 py-2 text-sm">
            <option value="">Pick the part, at the base that has it</option>
            {stock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          {error("part_id")}
        </div>
        <div>
          <label htmlFor="req-qty" className="field-label">
            Quantity<span className="text-status-red"> *</span>
          </label>
          <input id="req-qty" name="quantity" inputMode="decimal" defaultValue="1" className="ff-input px-3 py-2 text-sm" />
          {error("quantity")}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="req-base" className="field-label">
            For Base<span className="text-status-red"> *</span>
          </label>
          {bases.length > 0 ? (
            <select id="req-base" name="requesting_base" defaultValue="" className="ff-input px-3 py-2 text-sm">
              <option value="">Pick the base asking</option>
              {bases.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} · {b.name}
                </option>
              ))}
            </select>
          ) : (
            <input id="req-base" name="requesting_base" maxLength={10} placeholder="PABE" className="ff-input px-3 py-2 text-sm uppercase" />
          )}
          {error("requesting_base")}
        </div>
        <div>
          <label htmlFor="req-priority" className="field-label">
            Priority
          </label>
          <select id="req-priority" name="priority" defaultValue="normal" className="ff-input px-3 py-2 text-sm">
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
            <option value="aog">AOG</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="req-notes" className="field-label">
          Notes
        </label>
        <textarea id="req-notes" name="notes" rows={2} className="ff-input px-3 py-2 text-sm" placeholder="What it's for" />
      </div>
      <button type="submit" disabled={pending} className={buttonSolid}>
        Send Request
      </button>
    </form>
  );
}

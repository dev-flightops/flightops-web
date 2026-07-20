"use client";

import { useActionState } from "react";

import {
  CUSTOMER_TYPES,
  CUSTOMER_TYPE_LABELS,
} from "@/lib/api/reservations";

import {
  createCustomerAction,
  type NewCustomerFormState,
} from "./actions";

const _initial: NewCustomerFormState = { status: "idle" };

export function CustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    _initial,
  );
  return (
    <form action={formAction} className="space-y-4">
      {state.status === "error" && state.message ? (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      ) : null}

      <Field label="Full name" name="full_name" error={state.fieldErrors?.full_name}>
        <input
          id="full_name"
          name="full_name"
          required
          maxLength={200}
          className="ff"
          autoComplete="name"
        />
      </Field>

      <Field
        label="Company / agency (optional)"
        name="company_name"
        error={state.fieldErrors?.company_name}
      >
        <input
          id="company_name"
          name="company_name"
          maxLength={200}
          className="ff"
          autoComplete="organization"
        />
      </Field>

      <Field label="Type" name="customer_type" error={state.fieldErrors?.customer_type}>
        <select
          id="customer_type"
          name="customer_type"
          defaultValue="individual"
          className="ff"
        >
          {CUSTOMER_TYPES.map((t) => (
            <option key={t} value={t}>
              {CUSTOMER_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" error={state.fieldErrors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            className="ff"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" name="phone" error={state.fieldErrors?.phone}>
          <input
            id="phone"
            name="phone"
            type="tel"
            maxLength={40}
            className="ff"
            autoComplete="tel"
          />
        </Field>
      </div>

      <Field label="Notes" name="notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={4000}
          className="ff"
        />
      </Field>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create Customer"}
        </button>
      </div>

      <style>{`
        .ff {
          width: 100%;
          background: hsl(var(--background));
          color: hsl(var(--foreground));
          border: 1px solid hsl(var(--border));
          border-radius: 8px;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          outline: none;
        }
        .ff:focus:not(:disabled) {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
        }
        textarea.ff { resize: vertical; font-family: inherit; }
      `}</style>
    </form>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={name}
        className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-[0.6875rem] text-status-red">{error}</p>
      ) : null}
    </div>
  );
}

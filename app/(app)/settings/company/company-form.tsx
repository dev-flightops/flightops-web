"use client";

import { useActionState, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { CompanyProfileResponse } from "@/lib/api/types";

import { updateCompanyAction, type UpdateCompanyState } from "./actions";
import { taxPercentFromFraction } from "./invoicing";

const FIELDS = [
  "legal_name",
  "short_name",
  "part_135_certificate",
  "fiscal_year_end",
  "carrier_code",
  "logo_url",
  "street_line_1",
  "street_line_2",
  "city",
  "state",
  "postal_code",
  "country",
  "main_phone",
  "ops_phone",
  "main_email",
  "ops_email",
  "cargo_rate_per_lb",
  "invoice_tax_percent",
  "invoice_terms_days",
  "notes",
] as const;
type FieldName = (typeof FIELDS)[number];
type Values = Record<FieldName, string>;

/** The stored profile as the form shows it: the tax as a percentage. */
function toValues(p: CompanyProfileResponse): Values {
  const values = {} as Values;
  for (const name of FIELDS) {
    if (name === "invoice_tax_percent") {
      values[name] = taxPercentFromFraction(p.invoice_tax_rate);
    } else if (name === "invoice_terms_days") {
      values[name] = p.invoice_terms_days == null ? "" : String(p.invoice_terms_days);
    } else {
      values[name] = p[name] ?? "";
    }
  }
  return values;
}

export function CompanyForm({ profile }: { profile: CompanyProfileResponse }) {
  const [state, action, pending] = useActionState<
    UpdateCompanyState,
    FormData
  >(updateCompanyAction, { status: "idle" });

  // WHY THE FIELDS ARE CONTROLLED
  //
  // React resets a form's DOM when its action completes, refused or not.
  // These fields were uncontrolled, so a refused save (a tax of 101, say)
  // put every field back to what was stored: a cargo rate or terms typed
  // beside the bad value vanished, and the next "Saved." stored the old
  // ones. Controlled inputs keep what was typed through the reset, as on
  // the employee record (employee-record-form.tsx). There are no selects
  // here, so no remount is needed.
  const [values, setValues] = useState(() => toValues(profile));

  // Adopt the stored profile when it changes: a save landed and
  // revalidatePath handed back what the service kept ("0.475" stored as
  // "0.4750", a carrier code uppercased). Compared by content, so a
  // re-render with an equal profile does not wipe edits in progress.
  const stored = JSON.stringify(toValues(profile));
  const [syncedFrom, setSyncedFrom] = useState(stored);
  if (stored !== syncedFrom) {
    setSyncedFrom(stored);
    setValues(toValues(profile));
  }

  const bind = (name: FieldName) => ({
    name,
    value: values[name],
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  const fieldError = (key: string) =>
    state.status === "field-errors" ? state.errors[key] : undefined;

  return (
    <form action={action} className="space-y-6">
      {state.status === "api-error" && (
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-2 text-xs text-status-red"
        >
          {state.message}
        </div>
      )}
      {state.status === "saved" && (
        <div
          role="status"
          className="rounded-md border border-status-green/40 bg-status-green/10 px-3 py-2 text-xs text-status-green"
        >
          Saved.
        </div>
      )}

      <Section title="Identity">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            {...bind("legal_name")}
            label="Legal Name"
            placeholder="Aurora Air LLC"
            error={fieldError("legal_name")}
          />
          <Field
            {...bind("short_name")}
            label="Short Name"
            placeholder="Aurora"
            error={fieldError("short_name")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            {...bind("part_135_certificate")}
            label="Part 135 Certificate"
            placeholder="ABC123"
            error={fieldError("part_135_certificate")}
          />
          <Field
            {...bind("fiscal_year_end")}
            label="Fiscal Year End"
            type="date"
            error={fieldError("fiscal_year_end")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* The schedule export is filed under this code and refuses
              to run without it, rather than substituting one — so the
              hint says what it is for. */}
          <Field
            {...bind("carrier_code")}
            label="Carrier Code"
            placeholder="PG"
            hint="IATA (2 letters) or ICAO (3). Used by the schedule export, which will not run without it."
            error={fieldError("carrier_code")}
          />
        </div>
        <Field
          {...bind("logo_url")}
          label="Logo URL"
          placeholder="https://example.com/logo.png"
          error={fieldError("logo_url")}
        />
      </Section>

      <Section title="Address">
        <Field
          {...bind("street_line_1")}
          label="Street"
          placeholder="123 Hangar Row"
          error={fieldError("street_line_1")}
        />
        <Field
          {...bind("street_line_2")}
          label="Suite / Unit"
          error={fieldError("street_line_2")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            {...bind("city")}
            label="City"
            error={fieldError("city")}
          />
          <Field
            {...bind("state")}
            label="State"
            error={fieldError("state")}
          />
          <Field
            {...bind("postal_code")}
            label="Postal Code"
            error={fieldError("postal_code")}
          />
        </div>
        <Field
          {...bind("country")}
          label="Country"
          error={fieldError("country")}
        />
      </Section>

      <Section title="Contacts">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            {...bind("main_phone")}
            label="Main Phone"
            error={fieldError("main_phone")}
          />
          <Field
            {...bind("ops_phone")}
            label="Operations Phone"
            error={fieldError("ops_phone")}
          />
          <Field
            {...bind("main_email")}
            label="Main Email"
            type="email"
            error={fieldError("main_email")}
          />
          <Field
            {...bind("ops_email")}
            label="Operations Email"
            type="email"
            error={fieldError("ops_email")}
          />
        </div>
      </Section>

      {/* What every invoice raised from a flight is priced and dated
          with. Blank is a real state for each, and the hints say what
          it does, because a cargo line with no rate cannot be sent. */}
      <Section title="Invoicing">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            {...bind("cargo_rate_per_lb")}
            label="Cargo Rate (per lb)"
            inputMode="decimal"
            placeholder="0.4750"
            hint="Dollars per pound, up to four decimals. Prices each cargo line; left blank, cargo is raised with no price and the invoice can't be marked as sent."
            error={fieldError("cargo_rate_per_lb")}
          />
          <Field
            {...bind("invoice_tax_percent")}
            label="Invoice Tax Rate (%)"
            inputMode="decimal"
            placeholder="7.5"
            hint="Percent of each invoice's subtotal, 0 to 100. Blank adds no tax."
            error={fieldError("invoice_tax_percent")}
          />
          <Field
            {...bind("invoice_terms_days")}
            label="Payment Terms (days)"
            inputMode="numeric"
            placeholder="30"
            hint="Days from the invoice date to the due date, 0 to 365. Blank means 30."
            error={fieldError("invoice_terms_days")}
          />
        </div>
      </Section>

      <Section title="Notes">
        {/* The section title is a heading, not a label: without this a
            screen reader announced an unnamed text box (#41). */}
        <label htmlFor="notes" className="sr-only">
          Notes
        </label>
        <textarea
          id="notes"
          {...bind("notes")}
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-4 rounded-lg border border-border bg-card p-5">
      <legend className="px-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({
  name,
  label,
  error,
  hint,
  type = "text",
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
  /** Standing note under the field — what it is for, not what went
   *  wrong. Destructured out rather than spread, or it would reach the
   *  input as an invalid DOM attribute. Tied to the input by
   *  aria-describedby so a screen reader reads it with the label
   *  rather than after the whole form. */
  hint?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={hintId}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-[0.65rem] text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

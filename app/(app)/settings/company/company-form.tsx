"use client";

import { useActionState } from "react";

import { Spinner } from "@/components/ui/spinner";
import type { CompanyProfileResponse } from "@/lib/api/types";

import { updateCompanyAction, type UpdateCompanyState } from "./actions";

export function CompanyForm({ profile }: { profile: CompanyProfileResponse }) {
  const [state, action, pending] = useActionState<
    UpdateCompanyState,
    FormData
  >(updateCompanyAction, { status: "idle" });

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
            name="legal_name"
            label="Legal Name"
            placeholder="Aurora Air LLC"
            defaultValue={profile.legal_name ?? ""}
            error={fieldError("legal_name")}
          />
          <Field
            name="short_name"
            label="Short Name"
            placeholder="Aurora"
            defaultValue={profile.short_name ?? ""}
            error={fieldError("short_name")}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="part_135_certificate"
            label="Part 135 Certificate"
            placeholder="ABC123"
            defaultValue={profile.part_135_certificate ?? ""}
            error={fieldError("part_135_certificate")}
          />
          <Field
            name="fiscal_year_end"
            label="Fiscal Year End"
            type="date"
            defaultValue={profile.fiscal_year_end ?? ""}
            error={fieldError("fiscal_year_end")}
          />
        </div>
        <Field
          name="logo_url"
          label="Logo URL"
          placeholder="https://example.com/logo.png"
          defaultValue={profile.logo_url ?? ""}
          error={fieldError("logo_url")}
        />
      </Section>

      <Section title="Address">
        <Field
          name="street_line_1"
          label="Street"
          placeholder="123 Hangar Row"
          defaultValue={profile.street_line_1 ?? ""}
          error={fieldError("street_line_1")}
        />
        <Field
          name="street_line_2"
          label="Suite / Unit"
          defaultValue={profile.street_line_2 ?? ""}
          error={fieldError("street_line_2")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            name="city"
            label="City"
            defaultValue={profile.city ?? ""}
            error={fieldError("city")}
          />
          <Field
            name="state"
            label="State"
            defaultValue={profile.state ?? ""}
            error={fieldError("state")}
          />
          <Field
            name="postal_code"
            label="Postal Code"
            defaultValue={profile.postal_code ?? ""}
            error={fieldError("postal_code")}
          />
        </div>
        <Field
          name="country"
          label="Country"
          defaultValue={profile.country ?? ""}
          error={fieldError("country")}
        />
      </Section>

      <Section title="Contacts">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="main_phone"
            label="Main Phone"
            defaultValue={profile.main_phone ?? ""}
            error={fieldError("main_phone")}
          />
          <Field
            name="ops_phone"
            label="Operations Phone"
            defaultValue={profile.ops_phone ?? ""}
            error={fieldError("ops_phone")}
          />
          <Field
            name="main_email"
            label="Main Email"
            type="email"
            defaultValue={profile.main_email ?? ""}
            error={fieldError("main_email")}
          />
          <Field
            name="ops_email"
            label="Operations Email"
            type="email"
            defaultValue={profile.ops_email ?? ""}
            error={fieldError("ops_email")}
          />
        </div>
      </Section>

      <Section title="Notes">
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={profile.notes ?? ""}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none"
        />
      </Section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-status-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
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
  type = "text",
  ...inputProps
}: React.InputHTMLAttributes<HTMLInputElement> & {
  name: string;
  label: string;
  error?: string;
}) {
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
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        {...inputProps}
      />
      {error && (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      )}
    </div>
  );
}

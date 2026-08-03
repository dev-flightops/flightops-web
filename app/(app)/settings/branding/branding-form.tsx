"use client";

import { useActionState, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

import {
  updateBrandingAction,
  type UpdateBrandingState,
} from "./actions";

/** Client form for setting the tenant's primary + primary-dark brand
 *  colors. Live preview shows a mock button pair in the current values
 *  so the admin sees the effect before saving. Empty inputs clear the
 *  overrides — the backend + BrandThemeStyle both treat NULL as "use
 *  the platform default". */
export function BrandingForm({
  initialPrimary,
  initialPrimaryDark,
}: {
  initialPrimary: string | null;
  initialPrimaryDark: string | null;
}) {
  const [state, action, pending] = useActionState<UpdateBrandingState, FormData>(
    updateBrandingAction,
    { status: "idle" },
  );

  const [primary, setPrimary] = useState(initialPrimary ?? "");
  const [primaryDark, setPrimaryDark] = useState(initialPrimaryDark ?? "");

  const previewPrimary = useMemo(() => _validHex(primary) ?? "#0a84ff", [primary]);
  const previewDark = useMemo(
    () => _validHex(primaryDark) ?? _validHex(primary) ?? "#0070e0",
    [primaryDark, primary],
  );

  const fieldError = (k: string) =>
    state.status === "field-errors" ? state.errors[k] : undefined;

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
          Brand theme saved. Applied across the app.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ColorField
          name="brand_primary_color"
          label="Primary color"
          hint="Buttons, links, active-nav highlights."
          value={primary}
          onChange={setPrimary}
          error={fieldError("brand_primary_color")}
        />
        <ColorField
          name="brand_primary_dark_color"
          label="Primary — dark (hover)"
          hint="A darker variant used for hover / active states."
          value={primaryDark}
          onChange={setPrimaryDark}
          error={fieldError("brand_primary_dark_color")}
        />
      </div>

      {/* Live preview — updates as the user types */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="mb-3 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Preview
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-md px-4 py-2 text-xs font-semibold text-white transition-colors"
            style={{ backgroundColor: previewPrimary }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = previewDark;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = previewPrimary;
            }}
          >
            Primary button
          </button>
          <a
            href="#preview"
            onClick={(e) => e.preventDefault()}
            className="text-xs font-semibold underline-offset-2 hover:underline"
            style={{ color: previewPrimary }}
          >
            Text link
          </a>
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wider"
            style={{
              color: previewPrimary,
              borderColor: previewPrimary,
              backgroundColor: `${previewPrimary}14`,
            }}
          >
            Chip / badge
          </span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-primary-dark disabled:opacity-60"
        >
          {pending && <Spinner size="xs" />}
          {pending ? "Saving…" : "Save brand theme"}
        </button>
      </div>
    </form>
  );
}

function ColorField({
  name,
  label,
  hint,
  value,
  onChange,
  error,
}: {
  name: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const swatch = _validHex(value);
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type="text"
          placeholder="#AB2429 or blank"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          spellCheck={false}
          aria-invalid={error ? "true" : undefined}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-status-blue focus:outline-none aria-[invalid=true]:border-status-red"
        />
        <span
          className="h-9 w-9 flex-shrink-0 rounded-md border border-border"
          style={{
            background: swatch
              ? swatch
              : "repeating-linear-gradient(45deg, transparent 0 4px, hsl(var(--muted)) 4px 8px)",
          }}
          aria-hidden
        />
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-[0.65rem] text-status-red">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-[0.65rem] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}

function _validHex(v: string): string | null {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v.trim()) ? v.trim() : null;
}

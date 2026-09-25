"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

import { Spinner } from "@/components/ui/spinner";
import { brandTones, DEFAULT_BRAND } from "@/lib/theme/brand";

import {
  extractBrandingAction,
  updateBrandingAction,
  type ExtractBrandingState,
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
  const [extractState, extractAction, extractPending] = useActionState<
    ExtractBrandingState,
    FormData
  >(extractBrandingAction, { status: "idle" });

  const [primary, setPrimary] = useState(initialPrimary ?? "");
  const [primaryDark, setPrimaryDark] = useState(initialPrimaryDark ?? "");

  // When an extract succeeds, pipe the suggested palette into the color
  // inputs. The user can then tweak before hitting Save.
  useEffect(() => {
    if (extractState.status === "ok") {
      setPrimary(extractState.primary);
      setPrimaryDark(extractState.primaryDark);
    }
  }, [extractState]);

  // The preview falls back exactly as the live theme does
  // (BrandThemeStyle): no colour → the platform default, no hover shade
  // → the one derived from the primary. It used to fall back to the old
  // theme's blue, previewing a colour the app no longer shows.
  // And it previews what the app will actually paint: a colour too light
  // to carry white text is deepened by brandTones, so the preview shows
  // that version and says so.
  const tones = useMemo(
    () => brandTones(_validHex(primary) ?? DEFAULT_BRAND),
    [primary],
  );
  const previewPrimary = tones.hex;
  const previewDark = useMemo(() => {
    const hover = _validHex(primaryDark);
    return hover ? brandTones(hover).hex : _channelsToHex(tones.darkRgb);
  }, [primaryDark, tones]);

  const fieldError = (k: string) =>
    state.status === "field-errors" ? state.errors[k] : undefined;

  return (
    <div className="space-y-6">
      {/* Suggest-from-URL form — separate <form> because it targets a
       *  different action than Save. Colors flow into the inputs below
       *  via useEffect, then the user hits Save when they're happy. */}
      <form
        action={extractAction}
        className="rounded-lg border border-border bg-card p-4"
      >
        <div className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Suggest from your website
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="url"
            placeholder="e.g. yourairline.com"
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={extractPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-accent disabled:opacity-60"
          >
            {extractPending && <Spinner size="xs" />}
            {extractPending ? "Extracting…" : "Suggest colors"}
          </button>
        </div>
        {extractState.status === "error" && (
          <p role="alert" className="mt-2 text-[0.7rem] text-status-red">
            {extractState.message}
          </p>
        )}
        {extractState.status === "ok" && (
          <p role="status" className="mt-2 text-[0.7rem] text-status-green">
            Suggested {extractState.primary} — review below and Save when
            ready.
          </p>
        )}
      </form>

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
        {tones.adjusted && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {primary} is too light for white text on buttons, so the app
            uses a deeper shade of it ({tones.hex}), shown here.
          </p>
        )}
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
    </div>
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
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none aria-[invalid=true]:border-status-red"
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
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function _validHex(v: string): string | null {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v.trim()) ? v.trim() : null;
}

/** "143 30 34" → "#8f1e22". The preview appends an alpha byte to its
 *  colours, so it needs hex rather than rgb(). */
function _channelsToHex(channels: string): string {
  return (
    "#" +
    channels
      .split(" ")
      .map((c) => Number(c).toString(16).padStart(2, "0"))
      .join("")
  );
}

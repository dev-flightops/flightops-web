"use client";

import { type CSSProperties, useActionState, useEffect, useMemo, useState } from "react";

import { buttonSolid, segment, segmentGroup } from "@/components/ff/controls";
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
  initialHomeImage = null,
}: {
  initialPrimary: string | null;
  initialPrimaryDark: string | null;
  /** The image behind Home (#118), a link. */
  initialHomeImage?: string | null;
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
  const [homeImage, setHomeImage] = useState(initialHomeImage ?? "");
  const [imageBroken, setImageBroken] = useState(false);

  // When an extract succeeds, pipe the suggested palette into the color
  // inputs, and the site's share image into Home's (#118) when it names
  // one. The user can then tweak before hitting Save.
  useEffect(() => {
    if (extractState.status === "ok") {
      setPrimary(extractState.primary);
      setPrimaryDark(extractState.primaryDark);
      if (extractState.homeImage) setHomeImage(extractState.homeImage);
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
  const previewDarkRgb = useMemo(() => {
    const hover = _validHex(primaryDark);
    return hover ? brandTones(hover).rgb : tones.darkRgb;
  }, [primaryDark, tones]);
  // The variables BrandThemeStyle would set, scoped to the preview box;
  // `.brand-preview` (globals.css) picks the text tone per theme from them.
  const previewVars = {
    "--brand-rgb": tones.rgb,
    "--brand-dark-rgb": previewDarkRgb,
    "--brand-light-rgb": tones.lightRgb,
  } as CSSProperties;

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
        <div className="mb-2 eyebrow">
          Suggest from your website
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            name="url"
            placeholder="e.g. yourairline.com"
            spellCheck={false}
            autoComplete="off"
            className="ff-input min-w-0 flex-1 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={extractPending}
            className="btn-caps inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-foreground hover:bg-accent disabled:opacity-60 text-[0.72rem]"
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
            Suggested {extractState.primary}
            {extractState.homeImage
              ? " and the site's own image for Home"
              : "; the site names no image for Home"}{" "}
            — review below and Save when ready.
          </p>
        )}
      </form>

      <form action={action} className="space-y-6">
        {state.status === "api-error" && (
          <div
            role="alert"
            className="notice notice-red"
          >
            {state.message}
          </div>
        )}
        {state.status === "saved" && (
          <div
            role="status"
            className="notice notice-green"
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

      {/* Live preview — updates as the user types. It paints with the app's
          own classes and the brand variables scoped to this box, so it shows
          what the app will: the colour as a fill, and for text the tone the
          theme uses (lighter on the dark navy, the colour itself in light). */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="eyebrow mb-3">Preview</div>
        <div className="brand-preview flex flex-wrap items-center gap-x-6 gap-y-3" style={previewVars}>
          <button type="button" className={buttonSolid}>
            Primary button
          </button>
          <a
            href="#preview"
            onClick={(e) => e.preventDefault()}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Text link
          </a>
          <span className="relative py-1 text-[0.8125rem] font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-brand-ink">
            Current tab
          </span>
          <span className={segmentGroup}>
            <span className={segment(true)}>Today</span>
            <span className={segment(false)}>Tomorrow</span>
          </span>
        </div>
        {tones.adjusted && (
          <p role="status" className="mt-3 text-xs text-muted-foreground">
            {primary} is too light to read everywhere the app uses it, so
            the app uses a deeper shade of it ({tones.hex}), shown here.
          </p>
        )}
      </div>

      <HomeImageField
        value={homeImage}
        onChange={setHomeImage}
        error={fieldError("home_image_url")}
        onBroken={setImageBroken}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="submit"
          disabled={pending || imageBroken}
          className="btn-caps inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-white hover:bg-brand-dark disabled:opacity-60 text-[0.72rem]"
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
        className="field-label"
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
          className="ff-input flex-1 px-3 py-2 font-mono text-sm aria-[invalid=true]:border-status-red"
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
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

/** The image behind Home (#118): a link, and how Home will look with it,
 *  drawn as Home draws it (a dark band, the scrim, the greeting). */
function HomeImageField({
  value,
  onChange,
  error,
  onBroken,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
  /** Whether the link fails to load as an image (#158). */
  onBroken: (broken: boolean) => void;
}) {
  const link = /^https?:\/\/\S+$/.test(value.trim()) ? value.trim() : null;
  // The client, 10/29: "The branding function does not work for images /
  // unless I am doing it wrong?" The field held the company's website, a
  // page rather than an image, and the preview just stayed blank. Loaded
  // here, an address that isn't an image says so, and isn't saved.
  const [broken, setBroken] = useState<string | null>(null);
  const isBroken = link !== null && broken === link;
  useEffect(() => onBroken(isBroken), [isBroken, onBroken]);
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <label htmlFor="home_image_url" className="field-label">
        Home image
      </label>
      <input
        id="home_image_url"
        name="home_image_url"
        type="text"
        inputMode="url"
        placeholder="https://yourairline.com/images/hero.jpg, or blank for none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={500}
        spellCheck={false}
        autoComplete="off"
        aria-invalid={error ? "true" : undefined}
        className="ff-input px-3 py-2 text-sm aria-[invalid=true]:border-status-red"
      />
      {error ? (
        <p role="alert" className="field-error">
          {error}
        </p>
      ) : isBroken ? (
        <p role="alert" className="field-error">
          That address isn&rsquo;t an image we can show: it&rsquo;s probably a web
          page. Open the picture you want, copy the image&rsquo;s own address
          (right-click it, then Copy image address), and paste that here.
        </p>
      ) : (
        <p className="mt-1 text-[0.65rem] text-muted-foreground">
          The address of a wide photo (ending .jpg, .png or .webp), shown
          behind the greeting on Home. Suggest from your website fills in the
          site&rsquo;s own image when it names one.
        </p>
      )}
      <div className="mt-4">
        <div className="eyebrow mb-2">Home preview</div>
        {link ? (
          <div className="dark relative h-32 overflow-hidden bg-ink sm:h-40">
            {/* The company's link on any host, so not next/image. */}
            <img
              src={link}
              alt=""
              onError={() => setBroken(link)}
              onLoad={() => setBroken(null)}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
            <p className="page-title absolute bottom-3 left-4 text-xl text-foreground">
              Good morning
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No image: Home shows the greeting on the page as it does today.
          </p>
        )}
      </div>
    </div>
  );
}

function _validHex(v: string): string | null {
  return /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(v.trim()) ? v.trim() : null;
}

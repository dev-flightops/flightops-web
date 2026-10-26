import Link from "next/link";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { BrandingForm } from "./branding-form";

/**
 * /settings/branding — per-tenant brand colors, and the image behind
 * Home (#118).
 *
 * First slice of the M3 AI-branded-theming feature (roadmap #12). MVP is
 * two hex color inputs (primary + primary-dark). Follow-up PRs add font
 * family, logo upload, and the AI extraction ("drop a URL → suggested
 * palette") that pulls the ai-service forward from M4.
 */

export const dynamic = "force-dynamic";

export default async function SettingsBrandingPage() {
  let primary: string | null = null;
  let primaryDark: string | null = null;
  let homeImage: string | null = null;
  let loadError: string | null = null;
  try {
    const profile = await getCompanyProfile();
    primary = profile.brand_primary_color;
    primaryDark = profile.brand_primary_dark_color;
    homeImage = profile.home_image_url ?? null;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Brand theme unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">Branding</span>
      </nav>

      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">Branding</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Your brand colors across every module, and your image behind
          Home. Applied as soon as you save.
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 notice notice-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && (
        <BrandingForm
          initialPrimary={primary}
          initialPrimaryDark={primaryDark}
          initialHomeImage={homeImage}
        />
      )}
    </div>
  );
}

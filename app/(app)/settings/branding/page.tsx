import Link from "next/link";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { BrandingForm } from "./branding-form";

/**
 * /settings/branding — per-tenant brand colors.
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
  let loadError: string | null = null;
  try {
    const profile = await getCompanyProfile();
    primary = profile.brand_primary_color;
    primaryDark = profile.brand_primary_dark_color;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Brand theme unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Branding</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Override the platform&apos;s primary accent with your brand colors.
          Applied instantly across every module.
        </p>
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && (
        <BrandingForm
          initialPrimary={primary}
          initialPrimaryDark={primaryDark}
        />
      )}
    </div>
  );
}

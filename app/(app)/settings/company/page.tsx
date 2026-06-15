import Link from "next/link";

import { getCompanyProfile } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

import { CompanyForm } from "./company-form";

/**
 * /settings/company — Company profile editor (M2-G-46).
 *
 * Single-form page bound to the get-or-create CompanyProfile row. PATCH
 * semantics: each field is independently nullable so partial saves
 * never clobber other columns.
 */
export default async function SettingsCompanyPage() {
  try {
    const profile = await getCompanyProfile();
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Breadcrumb />
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Company Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Legal name, mailing address, contacts, and Part 135 certificate
          </p>
        </header>
        <CompanyForm profile={profile} />
      </div>
    );
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    const message =
      status === 401
        ? "Your session expired — please sign in again."
        : "Company profile unavailable. Try refreshing in a moment.";
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Breadcrumb />
        <div
          role="alert"
          className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {message}
        </div>
      </div>
    );
  }
}

function Breadcrumb() {
  return (
    <nav className="mb-4 text-xs text-muted-foreground">
      <Link href="/settings" className="hover:text-foreground">
        Settings
      </Link>
      <span className="px-1.5">/</span>
      <span className="text-foreground">Company</span>
    </nav>
  );
}

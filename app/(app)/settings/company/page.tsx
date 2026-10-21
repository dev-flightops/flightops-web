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
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Breadcrumb />
        <header className="mb-6 border-b border-border pb-5">
          <h1 className="page-title">Company Profile</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Legal name, mailing address, contacts, Part 135 certificate,
            and how invoices are priced and dated
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
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Breadcrumb />
        <div
          role="alert"
          className="notice notice-yellow"
        >
          {message}
        </div>
      </div>
    );
  }
}

function Breadcrumb() {
  return (
    <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
      <Link href="/settings" className="hover:text-foreground">
        Settings
      </Link>
      <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
      <span className="text-foreground">Company</span>
    </nav>
  );
}

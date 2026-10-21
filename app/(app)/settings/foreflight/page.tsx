import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getForeFlight, type ForeFlightConnection } from "@/lib/api/integrations";
import { INTEGRATION_ADMINS, PLAN_REVIEWERS, hasAnyRole } from "@/lib/roles";

import { ForeFlightSettings } from "./foreflight-settings";

/**
 * /settings/foreflight: the company's ForeFlight Dispatch connection (#54).
 *
 * The operator's pilots plan in ForeFlight. Our scheduled flights go
 * there with their crew and load, and the pilots' plans come back onto
 * the flights (#55). The key reads and writes the company's ForeFlight
 * account, so only the Director of Operations or an Exec Admin
 * (INTEGRATION_ADMINS) sees or changes any of this. Placing a plan
 * that waits is PLAN_REVIEWERS': dispatch, the DO and Exec Admins, who
 * get the queue's link.
 */

export const dynamic = "force-dynamic";
// Send now waits for every leg in the next 72 hours to reach ForeFlight.
export const maxDuration = 60;

export default async function ForeFlightSettingsPage() {
  const session = await auth();
  const canChange = hasAnyRole(session?.roles ?? [], INTEGRATION_ADMINS);
  const canReview = hasAnyRole(session?.roles ?? [], PLAN_REVIEWERS);
  let connection: ForeFlightConnection | null = null;
  let loadError: string | null = null;
  if (canChange) {
    try {
      connection = await getForeFlight();
    } catch (err) {
      loadError =
        err instanceof ApiError && err.status === 401
          ? "Your session expired. Sign in again."
          : "The ForeFlight connection couldn't be loaded. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="eyebrow mb-4 flex flex-wrap items-center">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span aria-hidden className="px-1.5 text-muted-foreground">/</span>
        <span className="text-foreground">ForeFlight</span>
      </nav>
      <header className="mb-6 border-b border-border pb-5">
        <h1 className="page-title">ForeFlight</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Send the company&rsquo;s scheduled flights to ForeFlight Dispatch, so pilots plan on flights
          that already carry their crew and load, and bring their plans back onto the flights.
          Peregrine&rsquo;s own weight and balance check stays the record.
        </p>
      </header>
      {!canChange ? (
        <p className="notice notice-gray text-muted-foreground">
          The Director of Operations or an Exec Admin connects ForeFlight.
        </p>
      ) : loadError || !connection ? (
        <p
          role="alert"
          className="notice notice-red"
        >
          {loadError ?? "The ForeFlight connection couldn't be loaded."}
        </p>
      ) : (
        <ForeFlightSettings connection={connection} canReview={canReview} />
      )}
    </div>
  );
}

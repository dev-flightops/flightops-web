import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getForeFlight, type ForeFlightConnection } from "@/lib/api/integrations";
import { INTEGRATION_ADMINS, hasAnyRole } from "@/lib/roles";

import { ForeFlightSettings } from "./foreflight-settings";

/**
 * /settings/foreflight: the company's ForeFlight Dispatch connection (#54).
 *
 * The operator's pilots plan in ForeFlight. Our scheduled flights go
 * there with their crew and load; bringing the pilot's plan back into
 * the flight follows (#55). The key reads and writes the company's
 * ForeFlight account, so only the Director of Operations or an Exec
 * Admin (INTEGRATION_ADMINS) sees or changes any of this.
 */

export const dynamic = "force-dynamic";

export default async function ForeFlightSettingsPage() {
  const session = await auth();
  const canChange = hasAnyRole(session?.roles ?? [], INTEGRATION_ADMINS);
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
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">ForeFlight</span>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">ForeFlight</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send the company&rsquo;s scheduled flights to ForeFlight Dispatch, so pilots plan on flights
          that already carry their crew and load. Peregrine&rsquo;s own weight and balance check stays
          the record.
        </p>
      </header>
      {!canChange ? (
        <p className="rounded-md border border-border bg-muted/60 px-3 py-3 text-xs text-muted-foreground">
          The Director of Operations or an Exec Admin connects ForeFlight.
        </p>
      ) : loadError || !connection ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-3 py-3 text-xs text-status-red"
        >
          {loadError ?? "The ForeFlight connection couldn't be loaded."}
        </p>
      ) : (
        <ForeFlightSettings connection={connection} />
      )}
    </div>
  );
}

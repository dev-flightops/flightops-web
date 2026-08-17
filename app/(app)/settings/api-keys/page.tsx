import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listApiKeys } from "@/lib/api/api-keys";

import { KeyManager } from "./key-manager";

/**
 * /settings/api-keys — issue and revoke Public API keys.
 *
 * Closes the M3 Public API story: #149 shipped the key model and
 * endpoints, #150 the read-only v1 surface those keys authenticate
 * against. This is the operator-facing half.
 *
 * Exec-admin only, enforced by auth-service. A non-admin gets a 403,
 * which renders as an explanation rather than a raw error — a chief
 * pilot landing here has done nothing wrong.
 */

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  let keys;
  try {
    keys = (await listApiKeys()).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    return (
      <Shell>
        <div className="rounded-lg border border-status-yellow/40 bg-status-yellow/5 p-4">
          <p className="text-sm text-status-yellow">
            {status === 403
              ? "API keys are managed by an Exec Admin."
              : status === 401
                ? "Your session expired — please sign in again."
                : "Couldn't load API keys. Try again in a moment."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <KeyManager keys={keys} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        href="/settings"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        ← Settings
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        Public API keys
      </h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">
        Keys authenticate partner access to the read-only Public API —
        flights, fleet and bookings for your operation only. Each key is
        scoped to this operator and can be revoked at any time.
      </p>
      {children}
    </div>
  );
}

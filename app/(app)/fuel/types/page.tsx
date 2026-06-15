import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listFuelTypes } from "@/lib/api/ground";
import type { FuelTypeResponse } from "@/lib/api/types";

/**
 * /fuel/types — Fuel type catalog (M2-G-44).
 *
 * Read-only listing of the tenant's fuel-type directory. Adding /
 * editing / toggling active state lives in M2-G-44b; the backend
 * supports it (POST / PATCH `/ground/fuel/types`).
 */
export default async function FuelTypesPage() {
  let types: FuelTypeResponse[] = [];
  let loadError: string | null = null;

  try {
    types = (await listFuelTypes({ includeInactive: true })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Types feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <Link
          href="/fuel"
          className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Fuel
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Fuel Types</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tenant catalog — Jet A, 100LL, mogas, etc.
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : types.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No fuel types configured yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Add via the API: <code>POST /ground/fuel/types</code>. The UI for
            this ships in M2-G-44b.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3 text-right">Sort order</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">
                    {t.code}
                  </td>
                  <td className="px-4 py-3 text-foreground">{t.label}</td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {t.sort_order}
                  </td>
                  <td className="px-4 py-3">
                    {t.is_active ? (
                      <span className="rounded-md border border-status-green/40 bg-status-green/10 px-2 py-0.5 text-[0.65rem] font-semibold text-status-green">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-md border border-border bg-card/60 px-2 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

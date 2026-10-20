import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
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
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6 border-b border-border pb-5">
        <Link
          href="/fuel"
          className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-2")}
        >
          <span aria-hidden>‹</span> Fuel
        </Link>
        <h1 className="page-title">Fuel Types</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
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
        <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No fuel types configured yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fuel types are added through the API for now:{" "}
            <code>POST /ground/fuel/types</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="ff-thead">
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
                      <span className="status-mark text-status-green">
                        Active
                      </span>
                    ) : (
                      <span className="eyebrow">
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

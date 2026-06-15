import Link from "next/link";

import { AddBaseDialog } from "@/components/settings/add-base-dialog";
import { DeactivateBaseButton } from "@/components/settings/deactivate-base-button";
import { EditBaseDialog } from "@/components/settings/edit-base-dialog";
import { listCompanyBases } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { CompanyBaseResponse } from "@/lib/api/types";

/**
 * /settings/bases — Master base directory (M2-G-47).
 *
 * Includes inactive bases by default so admins can re-activate them — flips
 * to active-only when ?active_only=true is passed. Active bases are listed
 * first (hubs at the top), inactive bases appear in a muted section below.
 */
export default async function SettingsBasesPage({
  searchParams,
}: {
  searchParams: Promise<{ active_only?: string }>;
}) {
  const { active_only } = await searchParams;
  const activeOnly = active_only === "true";

  let bases: CompanyBaseResponse[] = [];
  let loadError: string | null = null;
  try {
    const response = await listCompanyBases({ includeInactive: !activeOnly });
    bases = response.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Bases unavailable. Try refreshing in a moment.";
  }

  const active = bases.filter((b) => b.is_active);
  const inactive = bases.filter((b) => !b.is_active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Bases</span>
      </nav>

      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Master directory of ICAOs the operator works out of
          </p>
        </div>
        <AddBaseDialog />
      </header>

      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <Link
          href="/settings/bases"
          className={
            activeOnly
              ? "rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted/40"
              : "rounded-md border border-status-blue bg-status-blue/15 px-2.5 py-1 font-semibold text-status-blue"
          }
        >
          All
        </Link>
        <Link
          href="/settings/bases?active_only=true"
          className={
            activeOnly
              ? "rounded-md border border-status-blue bg-status-blue/15 px-2.5 py-1 font-semibold text-status-blue"
              : "rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted/40"
          }
        >
          Active only
        </Link>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && bases.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No bases yet. Add the first one to get going — start with your hub.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <BaseTable bases={active} />
        </section>
      )}

      {!activeOnly && inactive.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Inactive ({inactive.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card/40 opacity-70">
            <BaseTable bases={inactive} muted />
          </div>
        </section>
      )}
    </div>
  );
}

function BaseTable({
  bases,
  muted,
}: {
  bases: CompanyBaseResponse[];
  muted?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/20 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <tr>
          <th scope="col" className="px-4 py-2 text-left">ICAO</th>
          <th scope="col" className="px-4 py-2 text-left">Name</th>
          <th scope="col" className="px-4 py-2 text-left">Location</th>
          <th scope="col" className="px-4 py-2 text-left">Manager</th>
          <th scope="col" className="px-4 py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {bases.map((b) => (
          <tr
            key={b.id}
            className="border-b border-border last:border-b-0 hover:bg-muted/10"
          >
            <td className="px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold tracking-tight text-foreground">
                  {b.icao}
                </span>
                {b.is_hub && (
                  <span className="rounded-sm border border-status-blue/40 bg-status-blue/10 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.08em] text-status-blue">
                    Hub
                  </span>
                )}
              </div>
            </td>
            <td className="px-4 py-3">{b.display_name}</td>
            <td className="px-4 py-3 text-muted-foreground">
              {[b.city, b.state].filter(Boolean).join(", ") || "—"}
              {b.timezone && (
                <span className="ml-2 text-[0.65rem]">{b.timezone}</span>
              )}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {b.manager_name ?? "—"}
              {b.manager_phone && (
                <span className="ml-2 text-[0.7rem]">{b.manager_phone}</span>
              )}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                {!muted && <EditBaseDialog base={b} />}
                {!muted && (
                  <DeactivateBaseButton baseId={b.id} icao={b.icao} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

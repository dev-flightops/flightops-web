import Link from "next/link";

import { AddAircraftDialog } from "@/components/settings/add-aircraft-dialog";
import { EditAircraftDialog } from "@/components/settings/edit-aircraft-dialog";
import {
  ReactivateAircraftButton,
  RetireAircraftButton,
} from "@/components/settings/retire-aircraft-button";
import { ApiError } from "@/lib/api/client";
import { listAircraft } from "@/lib/api/ops";
import type { AircraftListItem } from "@/lib/api/types";

/** /settings/fleet — Fleet management.
 *
 * Admin surface for adding / editing / retiring aircraft. Active fleet
 * up top, retired airframes in a muted section below (with a Reactivate
 * button so nothing is permanently gone).
 *
 * Writes require Role.EXEC_ADMIN or Role.MAINTENANCE — the reservations
 * service enforces this; the UI surfaces the 403 as a friendly message.
 */

export const dynamic = "force-dynamic";

export default async function SettingsFleetPage() {
  let aircraft: AircraftListItem[] = [];
  let loadError: string | null = null;
  try {
    aircraft = (await listAircraft()).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Fleet unavailable. Try refreshing in a moment.";
  }

  const active = aircraft.filter((a) => a.is_active);
  const retired = aircraft.filter((a) => !a.is_active);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <nav className="mb-4 text-xs text-muted-foreground">
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Fleet</span>
      </nav>

      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fleet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit, and retire aircraft. Retired airframes preserve their
            flight history and can be reactivated.
          </p>
        </div>
        <AddAircraftDialog />
      </header>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      {!loadError && aircraft.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No aircraft yet. Add the first tail to get going.
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <FleetTable aircraft={active} variant="active" />
        </section>
      )}

      {retired.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Retired ({retired.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card/40 opacity-80">
            <FleetTable aircraft={retired} variant="retired" />
          </div>
        </section>
      )}
    </div>
  );
}

function FleetTable({
  aircraft,
  variant,
}: {
  aircraft: AircraftListItem[];
  variant: "active" | "retired";
}) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-border bg-muted/20 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <tr>
          <th scope="col" className="px-4 py-2 text-left">Tail</th>
          <th scope="col" className="px-4 py-2 text-left">Model</th>
          <th scope="col" className="px-4 py-2 text-right">Seats</th>
          <th scope="col" className="px-4 py-2 text-right">Useful load</th>
          <th scope="col" className="px-4 py-2 text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {aircraft.map((a) => (
          <tr
            key={a.id}
            className="border-b border-border last:border-b-0 hover:bg-muted/10"
          >
            <td className="px-4 py-3">
              <span className="font-mono font-semibold tracking-tight text-foreground">
                {a.tail_number}
              </span>
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {a.model ?? "—"}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
              {a.seats}
            </td>
            <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
              {a.max_payload_lbs != null
                ? `${a.max_payload_lbs.toLocaleString("en-US")} lbs`
                : "—"}
            </td>
            <td className="px-4 py-3">
              <div className="flex items-center justify-end gap-2">
                {variant === "active" ? (
                  <>
                    <EditAircraftDialog aircraft={a} />
                    <RetireAircraftButton
                      aircraftId={a.id}
                      tailNumber={a.tail_number}
                    />
                  </>
                ) : (
                  <ReactivateAircraftButton aircraftId={a.id} />
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

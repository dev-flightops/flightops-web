import { FleetCard } from "@/components/maintenance/fleet-card";
import { MaintenanceHeader } from "@/components/maintenance/maintenance-header";
import { ApiError } from "@/lib/api/client";
import { getFleetAirworthiness } from "@/lib/api/maintenance";
import type { FleetAircraftSummary } from "@/lib/api/types";

/**
 * /maintenance — Fleet Management landing.
 *
 * Layout matches legacy `templates/maintenance/dashboard.html` after
 * the M2-G-22b restyle: title + subtitle on the left, action-button
 * row on the right (8 sub-modules — Due List / Work Orders /
 * Inspections / Inventory / Vendors / RTS Queue / Roster / + Aircraft,
 * all disabled until M3), then one card per aircraft below.
 *
 * Cards are powered by the M2-M-16 bulk airworthiness endpoint and
 * stacked vertically so each one gets the full page width — same as
 * legacy, which keeps TTAF/SMOH/Prop legible and the action target
 * (Details →) on the right edge where dispatchers expect it.
 */
export default async function MaintenanceLandingPage() {
  let items: FleetAircraftSummary[] = [];
  let loadError: string | null = null;

  try {
    items = (await getFleetAirworthiness()).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Maintenance feed unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <MaintenanceHeader />

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          {loadError}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-16 text-center">
          <div className="mb-3 text-3xl opacity-20" aria-hidden>
            &#9874;
          </div>
          <p className="text-sm text-muted-foreground">
            No aircraft in this tenant&apos;s fleet yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Add the first one through the &ldquo;+ Aircraft&rdquo; action
            once the create form ships in M3.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((summary) => (
            <FleetCard key={summary.aircraft.id} summary={summary} />
          ))}
        </div>
      )}
    </div>
  );
}

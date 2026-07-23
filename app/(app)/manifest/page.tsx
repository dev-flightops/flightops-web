import Link from "next/link";

/**
 * /manifest — legacy `templates/manifest/list.html` (companion to
 * `modules/manifest/router.py` — 20+ endpoints for manifest CRUD,
 * legs, bookings/cargo, PDF, recurring, T-100 report).
 *
 * Passenger Manifests list — weight & balance and passenger records
 * per flight. Columns: Date · Flight · Aircraft · Route · Pax · Total
 * Payload · Status (Draft gray / Final green) · row actions (Edit /
 * PDF). Right-side CTA: + New Manifest.
 *
 * There is no manifest backend yet — legacy's `passenger_manifests`,
 * `manifest_pax`, `manifest_cargo`, `manifest_legs` tables live in
 * `modules/manifest/models.py`. Marc's M2 tail still to port these
 * into the reservations-service (or a dedicated manifest-service).
 * Rendering the shell so the URL stops 404-ing and the layout is
 * ready to wire up when the endpoints land.
 *
 * Sub-nav placement: added under Reservations dept (legacy base.html
 * groups /manifest/ with /customers/, /charter/, /quyana/,
 * /acct-export/, /reservations/ per templates/base.html:358).
 */

const BACKEND_HINT =
  "Passenger Manifests ship with the reservations-service (M2 backend)";

export default function ManifestListPage() {
  const total = 0;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Passenger Manifests</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Weight &amp; balance and passenger records
          </p>
        </div>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={BACKEND_HINT}
          className="cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
        >
          + New Manifest
        </button>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Date</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Flight</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Route</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Pax</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Total Payload</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                <th scope="col" className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm">
                  <p className="mb-4 text-muted-foreground">
                    No manifests yet.
                  </p>
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title={BACKEND_HINT}
                    className="cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
                  >
                    Create First Manifest
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground/80">About manifests:</strong>{" "}
          A manifest captures the actual passengers, baggage, and cargo loaded
          onto a flight — required for weight-and-balance and legal-of-record
          purposes. Legacy has 20+ endpoints for manifest CRUD, per-leg
          bookings, cargo, PDF export, T-100 reporting, and recurring
          schedules; port lands with Marc's M2 reservations-service manifest
          extension. Compare {" "}
          <Link
            href="/reservations/fleet-board"
            className="text-status-blue hover:underline"
          >
            /reservations/fleet-board
          </Link>{" "}
          (which shows the schedule).
        </p>
      </div>
    </div>
  );
}

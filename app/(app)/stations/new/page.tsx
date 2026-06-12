import Link from "next/link";

import { NewStationForm } from "./new-station-form";

/**
 * /stations/new — Add Station page (M2-G-38b).
 *
 * Matches the legacy `templates/stations/form.html` layout: narrow
 * 2xl container, back link to /stations, title, then the form inside
 * a panel.
 */
export default function NewStationPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/stations"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Stations
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Add Station</h1>
      <div className="rounded-lg border border-border bg-card p-4">
        <NewStationForm />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Runway data ships separately — pull from FAA via the Override button on
        the station's row after creating.
      </p>
    </div>
  );
}

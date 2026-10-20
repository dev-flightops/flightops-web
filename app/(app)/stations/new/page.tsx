import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { hasAnyRole, STATION_ADMINS } from "@/lib/roles";

import { NewStationForm } from "./new-station-form";

/**
 * /stations/new — Add Station page (M2-G-38b).
 *
 * Matches the legacy `templates/stations/form.html` layout: narrow
 * 2xl container, back link to /stations, title, then the form inside
 * a panel.
 */
export default async function NewStationPage() {
  if (!hasAnyRole((await auth())?.roles ?? [], STATION_ADMINS)) {
    redirect("/stations");
  }
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href="/stations"
        className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-4")}
      >
        <span aria-hidden>‹</span> Stations
      </Link>
      <h1 className="page-title mb-6 border-b border-border pb-5">Add Station</h1>
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

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { linkCaps } from "@/components/ff/controls";
import { ApiError } from "@/lib/api/client";
import { getGseUnit, listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";
import { GSE_WRITERS, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { NewEquipmentForm } from "../../new/new-equipment-form";
import { updateEquipmentAction } from "./actions";

/**
 * /equipment/[id]/edit — Edit Equipment (#134). The Add form, filled with
 * the unit's values, saving with PATCH. Legacy had it; the port had none,
 * so a unit's station, interval or a typo in its serial could not change.
 */
export default async function EditEquipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!hasAnyRole((await auth())?.roles ?? [], GSE_WRITERS)) {
    redirect(`/equipment/${id}`);
  }
  const unit = await getGseUnit(id).catch((err: unknown) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  // The form still works without them; the station stays as it is.
  let stations: StationListItem[] = [];
  let stationsFailed = false;
  try {
    stations = (await listStations({ limit: 500 })).items;
  } catch {
    stationsFailed = true;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link
        href={`/equipment/${unit.id}`}
        className={cn(linkCaps, "text-muted-foreground hover:text-foreground mb-4")}
      >
        <span aria-hidden>‹</span> {unit.name}
      </Link>
      <h1 className="page-title mb-6 border-b border-border pb-5">Edit Equipment</h1>
      {stationsFailed && (
        <div role="alert" className="mb-4 notice notice-yellow">
          Couldn&apos;t load the stations: the unit keeps its own. Try again in a moment to move it.
        </div>
      )}
      <div className="rounded-lg border border-border bg-card p-4">
        <NewEquipmentForm
          stations={stations}
          unit={unit}
          submit={updateEquipmentAction.bind(null, unit.id)}
        />
      </div>
    </div>
  );
}

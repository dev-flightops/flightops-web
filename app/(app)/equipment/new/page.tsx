import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { listStations } from "@/lib/api/ground";
import type { StationListItem } from "@/lib/api/types";

import { NewEquipmentForm } from "./new-equipment-form";

/**
 * /equipment/new — Add Equipment page (M2-G-39b).
 *
 * Pre-fetches the tenant's stations so the form can show a real
 * dropdown for the optional station assignment. Empty list is OK —
 * the form falls back to "Unassigned".
 */
export default async function NewEquipmentPage() {
  let stations: StationListItem[] = [];
  let loadError: string | null = null;

  try {
    stations = (await listStations({ limit: 500 })).items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Couldn't load stations — the form still works; you can assign a station later.";
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/equipment"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground hover:underline"
      >
        ← Equipment
      </Link>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Add Equipment</h1>

      {loadError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <NewEquipmentForm stations={stations} />
      </div>
    </div>
  );
}

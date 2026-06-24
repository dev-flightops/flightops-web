import { ApiError } from "@/lib/api/client";
import { listMelItems } from "@/lib/api/maintenance";
import type { MelItemResponse } from "@/lib/api/types";

import { MelAckList } from "./mel-ack-list";

/**
 * Open MEL panel on the dispatch packet — Spec 7 mandate:
 *   "Each open MEL appears with a dispatcher acknowledgment checkbox."
 *
 * The panel only renders when an aircraft is in play. Loads open MEL
 * items for that tail server-side, then hands them to the client
 * `MelAckList` which manages checkbox state via URL params (same
 * pattern as the NOTAM acks — `?mels_acked=id1,id2`).
 *
 * When all open MELs are acknowledged the panel shows the green
 * "All MELs acknowledged" badge. With unacked items present, the
 * Release button stays available (Spec 7 doesn't hard-block release
 * on missing acks — just surfaces unack'd count). M3's release-time
 * gate will read the same query param.
 *
 * Empty state ("No open MELs") is rendered explicitly rather than
 * hidden so the dispatcher knows the panel ran and there's nothing
 * to ack — not just that the panel didn't render.
 */
export async function OpenMelPanel({
  aircraftId,
  ackedMelIds,
}: {
  aircraftId: string;
  ackedMelIds: string[];
}) {
  let items: MelItemResponse[] = [];
  let loadError: string | null = null;
  try {
    const response = await listMelItems({
      aircraftId,
      status: "open",
      limit: 100,
    });
    items = response.items;
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Sign in to see open MELs."
        : "MELs unavailable. Refresh in a moment.";
  }

  if (loadError) {
    return (
      <div
        role="alert"
        className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-5 py-3.5 text-xs text-status-yellow"
      >
        {loadError}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-md border border-status-green/40 bg-status-green/[0.06] px-5 py-3.5 text-xs">
        <span className="font-bold uppercase tracking-[0.06em] text-status-green">
          No open MELs
        </span>
        <span className="ml-2 text-muted-foreground">
          for this aircraft.
        </span>
      </div>
    );
  }

  return <MelAckList items={items} ackedMelIds={ackedMelIds} />;
}

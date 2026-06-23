import { permanentRedirect } from "next/navigation";

/**
 * Bookmark-safety redirect — per-log detail moved from
 * /flight-log/{id} to /flight-crew/elog/{id} with the elog surface
 * grouping under flight-crew. Preserve the id so deep links from
 * pilot emails / dispatch packets still land on the right log.
 */
export default async function FlightLogIdRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/flight-crew/elog/${id}`);
}

import { auth } from "@/auth";
import { getFlightOpening } from "@/lib/api/open-seats";
import { CHECKIN_ROLES, hasAnyRole } from "@/lib/roles";

import { OpenSeatsPanel } from "./open-seats-panel";

/**
 * The seats a no-show opened on this flight (#120), for the people ops
 * shows openings to: check-in staff, dispatch among them. Anyone else on
 * the page, and an ops build from before it, gets no panel and no
 * looking again.
 */
export async function OpenSeats({ flightId, timeZone }: { flightId: string; timeZone: string }) {
  const session = await auth();
  if (!hasAnyRole(session?.roles ?? [], CHECKIN_ROLES)) return null;
  const opening = await getFlightOpening(flightId).catch(() => null);
  return <OpenSeatsPanel flightId={flightId} initial={opening} canAct timeZone={timeZone} />;
}

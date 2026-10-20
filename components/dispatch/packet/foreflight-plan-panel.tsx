import { getFlightPlans, type FlightPlans } from "@/lib/api/integrations";

import { ForeFlightPlans } from "./foreflight-plans";

/**
 * The selected flight's ForeFlight plans (#55), loaded server-side like
 * the open MEL panel. A company that doesn't bring plans back sees
 * nothing; a failure to load costs the panel, not the packet.
 */
export async function ForeFlightPlanPanel({ flightId }: { flightId: string }) {
  let data: FlightPlans;
  try {
    data = await getFlightPlans(flightId);
  } catch {
    return (
      <div
        role="alert"
        className="notice notice-yellow"
      >
        ForeFlight plans unavailable. Refresh in a moment.
      </div>
    );
  }
  return <ForeFlightPlans data={data} />;
}

import { listMyHandoffs } from "@/lib/api/ops";

import { WaitingOnYouList } from "./waiting-on-you-list";

/** Home's Waiting on you (#175), fetched for the person signed in. */
export async function WaitingOnYou() {
  const handoffs = await listMyHandoffs().catch(() => null);
  return <WaitingOnYouList items={handoffs ? handoffs.items : null} />;
}

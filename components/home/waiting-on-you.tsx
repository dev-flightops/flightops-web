import { listMyOnboardingTasks } from "@/lib/api/onboarding";
import { listMyHandoffs } from "@/lib/api/ops";

import { WaitingOnYouList } from "./waiting-on-you-list";

/** Home's Waiting on you (#175), fetched for the person signed in, with
 *  their onboarding tasks (#180). */
export async function WaitingOnYou() {
  const [handoffs, onboarding] = await Promise.all([
    listMyHandoffs().catch(() => null),
    listMyOnboardingTasks()
      .then((r) => r.items)
      .catch(() => null),
  ]);
  return <WaitingOnYouList items={handoffs ? handoffs.items : null} onboarding={onboarding} />;
}

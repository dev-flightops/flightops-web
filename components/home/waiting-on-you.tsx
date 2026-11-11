import { getDrugAlcoholWaiting } from "@/lib/api/drug-alcohol";
import { listMyOnboardingTasks } from "@/lib/api/onboarding";
import { listMyHandoffs } from "@/lib/api/ops";

import { WaitingOnYouList } from "./waiting-on-you-list";

/** Home's Waiting on you (#175), fetched for the person signed in, with
 *  their onboarding tasks (#180) and, for whoever runs or oversees the drug
 *  and alcohol program, what it waits on. */
export async function WaitingOnYou() {
  const [handoffs, onboarding, drugAlcohol] = await Promise.all([
    listMyHandoffs().catch(() => null),
    listMyOnboardingTasks()
      .then((r) => r.items)
      .catch(() => null),
    getDrugAlcoholWaiting().catch(() => null),
  ]);
  return (
    <WaitingOnYouList
      items={handoffs ? handoffs.items : null}
      onboarding={onboarding}
      drugAlcohol={drugAlcohol}
    />
  );
}

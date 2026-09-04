import { getFleetBrainExamples } from "@/lib/api/ai";

import { FleetBrainChat } from "./fleetbrain-chat";

/**
 * /fleetbrain — the natural-language query surface.
 *
 * No role gate. FleetBrain reads what the asker can already see on the
 * dashboards, and every query runs under RLS on their own tenant, so
 * there is nothing here a dispatcher is not already entitled to.
 * Gating it would only push people back to reading the same numbers
 * off six different screens. The service applies the same rule.
 *
 * The example questions come from the service rather than being typed
 * here, so the suggestions cannot drift away from what the classifier
 * actually accepts.
 */

export const dynamic = "force-dynamic";

const FALLBACK_EXAMPLES = [
  "Give me an ops summary",
  "Which crew are legal tomorrow?",
  "What maintenance is due this week?",
  "Show open squawks",
  "How many flights today?",
];

export default async function FleetBrainPage() {
  let examples = FALLBACK_EXAMPLES;
  try {
    const fetched = await getFleetBrainExamples();
    if (fetched.length > 0) examples = fetched;
  } catch {
    // A prompt list is not worth failing the page over — the input
    // box works regardless, and the fallback is the same set the
    // service ships.
  }

  return <FleetBrainChat examples={examples} />;
}

import Link from "next/link";

import { MxChat } from "./mx-chat";

/**
 * /maintenance/mx-intelligence — the AI maintenance assistant.
 *
 * Legacy's `templates/maintenance/mx_intelligence.html`, reached from
 * the maintenance subnav as "✨ MX Intel".
 *
 * The examples are ours. Legacy offers none, and a blank prompt box on
 * a tool whose value depends on asking it the right kind of question is
 * a tool most people close. Each one is a question the records can
 * actually answer — recurring defects, a grounded aircraft, an MEL
 * coming due — rather than the general aviation trivia the model would
 * answer from nothing.
 */

export const dynamic = "force-dynamic";

const EXAMPLES = [
  "Which aircraft has a recurring squawk?",
  "Why is the grounded aircraft down, and what is outstanding on it?",
  "Any MEL items coming due soon?",
  "What open work orders are waiting on parts?",
];

export default function MxIntelligencePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/maintenance"
        className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
      >
        ← Maintenance
      </Link>
      <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
        <span aria-hidden className="text-status-purple">
          ✦
        </span>
        MX Intelligence
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Troubleshooting and pattern analysis over this operator&rsquo;s own
        maintenance records. It reads the fleet, the squawk history, open work
        orders and open MEL items — and tells you what it read, so an answer
        can be checked against its evidence.
      </p>

      <div className="mt-6">
        <MxChat examples={EXAMPLES} />
      </div>
    </div>
  );
}

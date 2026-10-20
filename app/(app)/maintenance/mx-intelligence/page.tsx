import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { cn } from "@/lib/utils";

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
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <header className="mb-6 border-b border-border pb-5">
        <Link href="/maintenance" className={cn(linkCaps, "mb-3 text-muted-foreground hover:text-foreground")}>
          <span aria-hidden>‹</span> Maintenance
        </Link>
        <h1 className="page-title text-balance">MX Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Troubleshooting and pattern analysis over this operator&rsquo;s own
          maintenance records. It reads the fleet, the squawk history, open work
          orders and open MEL items — and tells you what it read, so an answer
          can be checked against its evidence.
        </p>
      </header>

      <div>
        <MxChat examples={EXAMPLES} />
      </div>
    </div>
  );
}

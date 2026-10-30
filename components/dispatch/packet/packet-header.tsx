import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { buttonOutline, buttonSolid } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { cn } from "@/lib/utils";
import Link from "next/link";

import type { FlightDetail } from "@/lib/api/types";

/**
 * Top header of the dispatch packet page — title on the left, action
 * buttons (mode toggle, AI Assistant, History) on the right. AI
 * Assistant opens Peregrine Assistant (#114).
 *
 * Matches the legacy `templates/dispatch/form.html` top row. The mode
 * toggle is context-aware: in Planning Mode (no flight, or a flight
 * that isn't releasable) it's a locked pill; once a scheduled flight
 * is selected, it becomes "Switch to Release Mode →" — an anchor that
 * scrolls to the Release section in the right column (which already
 * holds the existing release flow). Legacy uses the same label.
 */

export function PacketHeader({
  tenantName,
  flight,
}: {
  tenantName: string;
  flight?: FlightDetail | null;
}) {
  const canRelease = flight?.status === "scheduled";

  return (
    <PageHeader
      title="Flight Dispatch Packet"
      description={`${tenantName} · FAR 135 Dispatch Release`}
      actions={
        <>
          {canRelease ? (
            // Anchor scrolls to the existing release section in the right
            // column. The actual state mutation lives on the ReleaseButton
            // there; legacy renders the same "switch" label as a button
            // that does the same hand-off.
            <a href="#release-actions" className={cn(buttonOutline, "border-primary text-primary")}>
              Switch to Release Mode →
            </a>
          ) : (
            <span
              title={
                flight
                  ? `This flight is ${flight.status} — nothing to release.`
                  : "Pick a scheduled flight to enable release."
              }
              className="status-mark mr-2 text-primary"
            >
              Planning mode
            </span>
          )}

          {/* Building a flight was only reachable from Flight Following,
              under the label "Open Flight". Dispatch is where a
              dispatcher goes to work a flight, so it is also where they
              go when the flight does not exist yet — the client reported
              being "mostly unsuccessful in building flight" on 9/9. Same
              single form, linked from where the need arises. */}
          <Link href="/flight-following/new" className={buttonSolid}>
            + New Flight
          </Link>

          {/* AI Assistant opens Peregrine Assistant (#114). */}
          <OpenAssistantButton
            className={cn(buttonOutline, "border-status-purple/40 text-status-purple")}
            disabledClassName={cn(buttonOutline, "cursor-not-allowed border-status-purple/40 text-status-purple")}
          >
            AI Assistant
          </OpenAssistantButton>

          {/* History had sat here disabled ("Coming in M3"): there is no
              packet history yet, so it isn't shown (#157). */}
        </>
      }
    />
  );
}

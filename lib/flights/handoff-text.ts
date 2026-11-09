import type { HandoffItem } from "@/lib/api/types";
import { formatLocal } from "@/lib/format/flight-time";
import { routeText } from "@/lib/route";

/**
 * What a hand-off says and where it leads (#175). The client, 9 Nov: "the
 * ability for the system to track the process and notify the next party in
 * the flow that their is an item that needs action/attention." The bell and
 * Home's Waiting on you list say the same words.
 */
export interface HandoffLine {
  title: string;
  detail: string;
  href: string;
  /** Red where the flight stopped: a release denied, a load returned. */
  severity: "red" | "yellow";
}

export function handoffLine(item: HandoffItem): HandoffLine {
  const flight = item.flight_number;
  const route = routeText(item);
  const at = formatLocal(item.occurred_at);
  const preflight = `/flight-crew/preflight/${item.flight_id}`;
  const packet = `/dispatch?flight=${item.flight_id}`;
  switch (item.kind) {
    case "frat_to_sign":
      if (item.turn === "pilot") {
        return {
          title: `Sign the FRAT — ${flight}`,
          detail: `${route}. ${item.by_name ?? "Dispatch"} scored and signed it at ${at}. Review it and sign it at preflight step 1.`,
          href: preflight,
          severity: "yellow",
        };
      }
      return {
        title: item.filed_by_pilot && item.refiled ? `FRAT changed by the pilot — ${flight}` : `Sign the FRAT — ${flight}`,
        detail: item.filed_by_pilot
          ? `${route}. ${item.by_name ?? "The pilot"} ${item.refiled ? "changed" : "filed"} it at ${at}. Review it and sign${item.refiled ? " again" : ""}; then the pilot signs.`
          : `${route}. Filed at ${at}; dispatch hasn't signed it yet.`,
        href: `/frat/${item.flight_id}`,
        severity: "yellow",
      };
    // Both signatures are the FRAT's part: the packet still has its own
    // checks (the crew's currency, NOTAMs, the weather), so not "ready".
    case "release_ready":
      return {
        title: `FRAT signed by both — ${flight}`,
        detail: `${route}. ${item.by_name ?? "The pilot"} signed it at ${at}; the release is next.`,
        href: packet,
        severity: "yellow",
      };
    case "release_to_accept":
      return {
        title: `Release to accept — ${flight}`,
        detail: `${route}. Released by ${item.by_name ?? "dispatch"} at ${at}. Review it and accept it in your preflight.`,
        href: preflight,
        severity: "yellow",
      };
    case "release_denied":
      return {
        title: `Release denied — ${flight}`,
        detail: `${item.by_name ?? "The pilot"}, ${at}: ${item.note ?? "no reason given."}`,
        href: packet,
        severity: "red",
      };
    case "weight_returned":
      return {
        title: `Returned over weight — ${flight}`,
        detail: `${item.by_name ?? "The pilot"} can take ${Number(item.note ?? 0).toLocaleString("en-US")} lb (${at}). Re-plan the load, then mark it re-planned.`,
        href: packet,
        severity: "red",
      };
  }
}

import { NotBuiltPage } from "@/components/not-built-page";

/**
 * /maintenance/rts — legacy `templates/maintenance/rts_queue.html`.
 *
 * Three-section RTS workflow (empty-state until Marc's M2 backend lands):
 *   1. RII — Awaiting Inspector Signoff (yellow header) — RII inspector
 *      form with cert number + confirm checkbox, plus Reject / Defer
 *      accordions
 *   2. Pending RTS — Awaiting Signoff (blue header) — AMT airworthy
 *      form (name + cert # + cert type + work notes + certify checkbox),
 *      plus Reject / Defer accordions
 *   3. Open Squawks on Held Aircraft (red header) — deep-link back to
 *      the aircraft detail
 *   Plus an "Aircraft Currently on RTS Hold" table.
 *
 * Renders the shell for all four sections with legacy headings so the
 * layout is intact; each section shows an empty-state row today. Swap
 * to real data (pending_rii, pending_non_rii, open_on_hold,
 * held_aircraft from `GET /maintenance/rts/queue`) once the endpoint
 * lands.
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function RtsQueuePage() {
  return (
    <NotBuiltPage
      title="Return to Service Queue"
      summary="Aircraft awaiting AMT sign-off or RII inspector review before they return to service."
      meanwhile={{
        text: "Grounded aircraft and the squawks holding them are on the",
        href: "/maintenance",
        label: "fleet view",
      }}
    />
  );
}

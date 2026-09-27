import { NotBuiltPage } from "@/components/not-built-page";

/**
 * /maintenance/mx-clock — legacy `templates/maintenance/mx_clock.html`.
 *
 * Track aircraft maintenance time with milestones. Sections:
 *   1. Begin Maintenance form (aircraft select + WO # + notes + Begin
 *      Work) — currently disabled shell
 *   2. Active clocks — each shows elapsed hours, mechanics chips,
 *      Join/Leave, milestone chips (Aircraft Pulled → Inspection Started
 *      → Parts Installed → Test Run Complete → Ready for RTS), and a
 *      Complete button
 *   3. Recently Completed table (Aircraft · Started · Completed · Total
 *      Hours · Started By)
 *
 * Backend not shipped — Marc's M2 maintenance-service MX Clock endpoints
 * still to land. Wired to the empty state today; swap to `listMxClocks`
 * once the endpoints exist.
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function MxClockPage() {
  return (
    <NotBuiltPage
      title="Maintenance Clock"
      summary="Track the time an aircraft spends in maintenance, milestone by milestone — pulled, inspection started, parts installed, test run complete, ready for return to service."
      meanwhile={{
        text: "Open maintenance jobs are on",
        href: "/maintenance/work-orders",
        label: "Work Orders",
      }}
    />
  );
}

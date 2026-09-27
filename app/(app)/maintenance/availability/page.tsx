import { NotBuiltPage } from "@/components/not-built-page";

/**
 * /maintenance/availability — legacy
 * `templates/maintenance/availability_report.html`.
 *
 * Aircraft Revenue Availability report. Date range filter + fleet
 * summary stat cards (Fleet Availability % · Revenue Hours · MX
 * Hours) + per-aircraft table (Aircraft · Availability bar+% ·
 * Revenue Hrs · MX Hrs · Ferry Hrs · Idle Hrs · Flights · MX Events
 * · Status). Availability status coloured green ≥90 %, yellow ≥75 %,
 * red below.
 *
 * Backend not shipped — Marc's M2 maintenance-service availability
 * roll-up query still to land. Rendering the shell with all stat
 * cards + full column set; swap to real data
 * (`getAvailabilityReport({ start, end })`) once the endpoint lands.
 *
 * NOT BUILT. This page used to render that layout with every control
 * disabled or empty, and the nav called it live because the file
 * existed. There is no maintenance-service endpoint behind it, so it
 * says so instead (components/not-built-page.tsx); the nav marks it
 * `planned`. The layout above is the brief for building it.
 */
export default function AvailabilityPage() {
  return (
    <NotBuiltPage
      title="Aircraft Revenue Availability"
      summary="Fleet availability over a period: revenue hours against maintenance hours, aircraft by aircraft."
      meanwhile={{
        text: "Each aircraft's status today is on the",
        href: "/maintenance",
        label: "fleet view",
      }}
    />
  );
}
